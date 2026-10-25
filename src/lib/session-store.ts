import "server-only";
import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import postgres from "postgres";
import { authenticationKeyMaterial, databaseConnectionString, newSessionId, type SessionClaims } from "@/lib/auth";
import { verifySovsiAccess, refreshSovsiSession, type SovsiIdentity } from "@/lib/sovsi-server";
import type { SessionUser, UserRole } from "@/lib/types";

let sqlClient: ReturnType<typeof postgres> | undefined;
function database() {
  const url = databaseConnectionString();
  if (!url) throw new Error("AUTH_UNAVAILABLE");
  if (!sqlClient) sqlClient = postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false, ssl: process.env.DATABASE_SSL === "false" ? false : "require" });
  return sqlClient;
}
const digest = (id: string) => createHash("sha256").update(id).digest("hex");

// Central credentials are encrypted at rest and never written to a browser-readable cookie.
function tokenKey() {
 const secret=authenticationKeyMaterial(); if(!secret)throw Error("AUTH_UNAVAILABLE");
 return createHash("sha256").update("sovsi-ai-mail-token-v1:"+secret).digest();
}
function seal(tokens:{access_token:string;refresh_token:string},sessionHash:string){
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",tokenKey(),iv);
 cipher.setAAD(Buffer.from(sessionHash));
 const body=Buffer.concat([cipher.update(JSON.stringify(tokens),"utf8"),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),body]).toString("base64url");
}
function unseal(value:string,sessionHash:string):{access_token:string;refresh_token:string}{
 const packed=Buffer.from(value,"base64url");if(packed.length<29)throw Error("UNAUTHORIZED");
 const cipher=createDecipheriv("aes-256-gcm",tokenKey(),packed.subarray(0,12));
 cipher.setAAD(Buffer.from(sessionHash));cipher.setAuthTag(packed.subarray(12,28));
 return JSON.parse(Buffer.concat([cipher.update(packed.subarray(28)),cipher.final()]).toString("utf8"));
}
/** Explicit subject mapping preserves the existing user ID, authorization version and mailbox ownership. */
export async function createFederatedSession(identity:SovsiIdentity,tokens:{access_token:string;refresh_token:string}) {
 const sql=database(),id=newSessionId(),hash=digest(id);
 const rows=await sql`
 INSERT INTO ai_mail_sessions (id_hash,user_id,auth_version,expires_at,sovsi_subject,sovsi_session_id,sovsi_tokens)
 SELECT ${hash},u.id,u.auth_version,NOW()+LEAST(s.session_timeout_minutes,10080)*INTERVAL '1 minute',
   ${identity.subject}::uuid,${identity.sessionId}::uuid,${seal(tokens,hash)}
 FROM ai_mail_sovsi_identity_links link JOIN ai_mail_users u ON u.id=link.user_id
 JOIN ai_mail_settings s ON s.id='default'
 JOIN auth.users au ON au.id::text=u.id
 WHERE link.subject=${identity.subject}::uuid AND link.enabled AND u.status='active'
   AND au.deleted_at IS NULL AND (au.banned_until IS NULL OR au.banned_until<=NOW())
 RETURNING user_id,EXTRACT(EPOCH FROM (expires_at-NOW()))::int AS duration
 `;
 if(rows.length!==1)throw Error("FORBIDDEN");
 const users=await sql`SELECT id,name,email,role FROM ai_mail_users WHERE id=${rows[0].user_id} AND status='active'`;
 if(users.length!==1)throw Error("FORBIDDEN");
 const u=users[0];return {sessionId:id,duration:Number(rows[0].duration),user:{id:String(u.id),name:String(u.name),email:String(u.email),role:u.role as UserRole,demo:false} satisfies SessionUser};
}
/** A signed cookie is only a lookup credential; local roles and central live session are rechecked. */
export async function findActiveSession(claims:SessionClaims):Promise<SessionUser|null>{
 if(claims.demo)return null;
 const sql=database(),hash=digest(claims.sessionId);
 return sql.begin(async tx=>{
  const rows=await tx`
   SELECT u.id,u.name,u.email,u.role,session.sovsi_subject,session.sovsi_session_id,session.sovsi_tokens
   FROM ai_mail_sessions session
   JOIN ai_mail_users u ON u.id=session.user_id AND u.auth_version=session.auth_version
   JOIN ai_mail_sovsi_identity_links link ON link.user_id=u.id AND link.subject=session.sovsi_subject AND link.enabled
   JOIN auth.users au ON au.id::text=u.id
   WHERE session.id_hash=${hash} AND u.id=${claims.id} AND session.revoked_at IS NULL AND session.expires_at>NOW()
    AND u.status='active' AND au.deleted_at IS NULL AND (au.banned_until IS NULL OR au.banned_until<=NOW())
    AND session.sovsi_tokens IS NOT NULL
   FOR UPDATE OF session
  `;
  if(rows.length!==1)return null;
  const row=rows[0];let tokens=unseal(String(row.sovsi_tokens),hash);
  // Decoding here only chooses whether to refresh. The signature and live session are always verified below.
  const exp=JSON.parse(Buffer.from(tokens.access_token.split('.')[1]||'','base64url').toString()).exp;
  if(typeof exp!=='number'||exp<=Date.now()/1000+60)tokens=await refreshSovsiSession(tokens.refresh_token,'ai-mail');
  const identity=await verifySovsiAccess(tokens.access_token,'ai-mail');
  if(identity.subject!==row.sovsi_subject||identity.sessionId!==row.sovsi_session_id)throw Error("UNAUTHORIZED");
  await tx`UPDATE ai_mail_sessions SET sovsi_tokens=${seal(tokens,hash)} WHERE id_hash=${hash} AND revoked_at IS NULL`;
  return {id:String(row.id),name:String(row.name),email:String(row.email),role:row.role as UserRole,demo:false};
 });
}
export async function revokeDatabaseSession(claims: SessionClaims): Promise<void> {
  if (claims.demo) return;
  const sql = database();
  await sql`UPDATE ai_mail_sessions SET revoked_at = NOW() WHERE id_hash = ${digest(claims.sessionId)} AND user_id = ${claims.id} AND revoked_at IS NULL`;
}

/** Distributed per-identity limit, containing credential stuffing across server instances. */
export async function consumeLoginAttempt(email: string): Promise<boolean> {
  const secret = authenticationKeyMaterial();
  if (!secret) throw new Error("AUTH_UNAVAILABLE");
  const key = createHmac("sha256", secret).update(`login:${email.toLowerCase()}`).digest("hex");
  const sql = database();
  const rows = await sql`
    INSERT INTO ai_mail_login_limits (key_hash, attempts, window_started_at) VALUES (${key}, 1, NOW())
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN ai_mail_login_limits.window_started_at < NOW() - INTERVAL '15 minutes' THEN 1 ELSE LEAST(ai_mail_login_limits.attempts + 1, 1000) END,
      window_started_at = CASE WHEN ai_mail_login_limits.window_started_at < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE ai_mail_login_limits.window_started_at END
    RETURNING attempts
  `;
  return Number(rows[0]?.attempts) <= 10;
}
