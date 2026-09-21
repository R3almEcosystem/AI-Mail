import "server-only";
import { createHash, createHmac } from "node:crypto";
import postgres from "postgres";
import { databaseConnectionString, newSessionId, type SessionClaims } from "@/lib/auth";
import type { SessionUser, UserRole } from "@/lib/types";

let sqlClient: ReturnType<typeof postgres> | undefined;
function database() {
  const url = databaseConnectionString();
  if (!url) throw new Error("AUTH_UNAVAILABLE");
  if (!sqlClient) sqlClient = postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false, ssl: process.env.DATABASE_SSL === "false" ? false : "require" });
  return sqlClient;
}
const digest = (id: string) => createHash("sha256").update(id).digest("hex");

/** Credential snapshot prevents issuing a session if the account changed during sign-in. */
export async function createDatabaseSession(user: SessionUser, verifiedPasswordHash: string, durationSeconds: number): Promise<string> {
  if (user.demo || !Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 604800) throw new Error("UNAUTHORIZED");
  const sql = database(); const id = newSessionId();
  const rows = await sql`
    INSERT INTO ai_mail_sessions (id_hash, user_id, auth_version, expires_at)
    SELECT ${digest(id)}, u.id, u.auth_version, NOW() + ${durationSeconds} * INTERVAL '1 second'
    FROM ai_mail_users u JOIN ai_mail_settings s ON s.id = 'default'
    WHERE u.id = ${user.id} AND u.status = 'active' AND u.role = ${user.role}
      AND u.email = ${user.email} AND u.password_hash = ${verifiedPasswordHash} AND s.require_mfa = FALSE
    RETURNING id_hash
  `;
  if (rows.length !== 1) throw new Error("UNAUTHORIZED");
  return id;
}

/** A signed cookie is only a lookup credential; current database state is authoritative. */
export async function findActiveSession(claims: SessionClaims): Promise<SessionUser | null> {
  if (claims.demo) return null;
  const sql = database();
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.role
    FROM ai_mail_sessions session
    JOIN ai_mail_users u ON u.id = session.user_id AND u.auth_version = session.auth_version
    JOIN ai_mail_settings settings ON settings.id = 'default'
    WHERE session.id_hash = ${digest(claims.sessionId)} AND u.id = ${claims.id}
      AND session.revoked_at IS NULL AND session.expires_at > NOW()
      AND u.status = 'active' AND settings.require_mfa = FALSE
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return { id: String(rows[0].id), name: String(rows[0].name), email: String(rows[0].email), role: rows[0].role as UserRole, demo: false };
}
export async function revokeDatabaseSession(claims: SessionClaims): Promise<void> {
  if (claims.demo) return;
  const sql = database();
  await sql`UPDATE ai_mail_sessions SET revoked_at = NOW() WHERE id_hash = ${digest(claims.sessionId)} AND user_id = ${claims.id} AND revoked_at IS NULL`;
}

/** Distributed per-identity limit, containing credential stuffing across server instances. */
export async function consumeLoginAttempt(email: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
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
