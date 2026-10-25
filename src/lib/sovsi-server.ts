import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
export const SOVSI_URL='https://ncpnzoxudhvqkoifsryc.supabase.co';
export const SOVSI_ISSUER=SOVSI_URL+'/auth/v1';
export const SOVSI_PUBLIC_KEY='sb_publishable_AzD4zArToAanYz-zYr9RgA_OagaSbnM';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keys=createRemoteJWKSet(new URL(SOVSI_ISSUER+'/.well-known/jwks.json'));
export type SovsiIdentity={subject:string;sessionId:string;clientId:string;email:string;emailConfirmedAt:string;claims:JWTPayload;accessToken:string};
export type SovsiPortalKey='gateway'|'si-mail'|'ai-mail';
const origins:Record<SovsiPortalKey,string>={gateway:'https://gateway.sovsi.xyz','si-mail':'https://si-mail.sovsi.xyz','ai-mail':'https://ai-mail.sovsi.xyz'};
export async function sovsiRegistration(portalKey:SovsiPortalKey){
 const q=new URLSearchParams({select:'client_id,redirect_uri',portal_key:'eq.'+portalKey,enabled:'eq.true'});
 const r=await fetch(SOVSI_URL+'/rest/v1/sovsi_identity_oauth_clients?'+q,{headers:{apikey:SOVSI_PUBLIC_KEY},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 const data=r.ok?await r.json():null;
 if(!Array.isArray(data)||data.length!==1||!uuid.test(data[0].client_id)||data[0].redirect_uri!==origins[portalKey]+'/identity/oauth/callback')throw Error('UNAUTHORIZED');
 return {clientId:data[0].client_id as string,origin:origins[portalKey]};
}
export async function verifySovsiAccess(accessToken:string,portalKey:SovsiPortalKey):Promise<SovsiIdentity>{
 if(typeof accessToken!=='string'||accessToken.length>16000)throw Error('UNAUTHORIZED');
 const {payload,protectedHeader}=await jwtVerify(accessToken,keys,{issuer:SOVSI_ISSUER,audience:'authenticated',algorithms:['ES256','RS256'],clockTolerance:0});
 const registration=await sovsiRegistration(portalKey);
 if(protectedHeader.jku||protectedHeader.jwk||protectedHeader.x5u||!uuid.test(payload.sub||'')||!uuid.test(String(payload.session_id||''))||payload.client_id!==registration.clientId||payload.role!=='authenticated'||payload.aal!=='aal2'||payload.is_anonymous===true||typeof payload.exp!=='number')throw Error('UNAUTHORIZED');
 const headers={apikey:SOVSI_PUBLIC_KEY,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'};
 const [userResponse,liveResponse]=await Promise.all([
  fetch(SOVSI_ISSUER+'/user',{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)}),
  fetch(SOVSI_URL+'/rest/v1/rpc/sovsi_portal_session_live_v1',{method:'POST',headers,body:JSON.stringify({p_portal_key:portalKey}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)})
 ]);
 if(!userResponse.ok||!liveResponse.ok)throw Error('UNAUTHORIZED');
 const [user,live]=await Promise.all([userResponse.json(),liveResponse.json()]);
 if(live!==true||user.id!==payload.sub||typeof user.email_confirmed_at!=='string'||!user.email_confirmed_at||user.is_anonymous===true||typeof user.email!=='string'||!user.factors?.some((f:{factor_type?:string;status?:string})=>f.factor_type==='totp'&&f.status==='verified'))throw Error('UNAUTHORIZED');
 return {subject:payload.sub!,sessionId:String(payload.session_id),clientId:registration.clientId,email:user.email,emailConfirmedAt:user.email_confirmed_at,claims:payload,accessToken};
}
export async function refreshSovsiSession(refreshToken:string,portalKey:SovsiPortalKey){
 const {clientId}=await sovsiRegistration(portalKey);
 const response=await fetch(SOVSI_ISSUER+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:clientId,refresh_token:refreshToken}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('UNAUTHORIZED');
 const tokens=await response.json();if(typeof tokens.access_token!=='string'||typeof tokens.refresh_token!=='string')throw Error('UNAUTHORIZED');return tokens as {access_token:string;refresh_token:string};
}
