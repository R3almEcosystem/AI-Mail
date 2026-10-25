// SOVSI first-party OAuth browser client. Public metadata only; no client secret.
// Every consumer must independently authorize its API and data access.
export const SOVSI_URL='https://ncpnzoxudhvqkoifsryc.supabase.co';
export const SOVSI_ISSUER=SOVSI_URL+'/auth/v1';
export const SOVSI_HOME='https://auth.sovsi.xyz';
export const SOVSI_PUBLIC_KEY='sb_publishable_AzD4zArToAanYz-zYr9RgA_OagaSbnM';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPTIONS={cache:'no-store',credentials:'omit',redirect:'error'};
function fail(message){throw new Error(message);}
function decode(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))fail('Invalid signed identity token.');
 const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function claimsOf(token){
 if(typeof token!=='string'||token.length>20000||token.split('.').length!==3)fail('Invalid signed identity token.');
 return JSON.parse(new TextDecoder().decode(decode(token.split('.')[1])));
}
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}
function audience(value,expected){return value===expected||Array.isArray(value)&&value.includes(expected);}

export function createSovsiPortal(options){
 const {portalKey,canonicalOrigin,defaultReturnTo='/',allowedReturnPaths=[defaultReturnTo],authorize}=options;
 if(!/^[a-z][a-z0-9-]{1,40}$/.test(portalKey))fail('Invalid portal configuration.');
 const origin=new URL(canonicalOrigin);
 if(origin.protocol!=='https:'||origin.origin!==canonicalOrigin||origin.username||origin.password)fail('Invalid portal origin.');
 const callback=canonicalOrigin+'/identity/oauth/callback';
 const storageKey='sovsi-'+portalKey+'-oauth-session-v1';
 const transactionKey='sovsi-'+portalKey+'-oauth-transaction-v1';
 const request=options.fetch||globalThis.fetch.bind(globalThis);
 const environment=options.environment||globalThis;
 const cryptoImpl=options.crypto||globalThis.crypto;
 const now=options.now||Date.now;
 const storage=()=>options.storage||environment.sessionStorage;
 const listeners=new Set();
 let generation=0,restoring=null,registration=null,session=null,jwks=null,jwksAt=0;
 const safeReturn=value=>allowedReturnPaths.includes(value)?value:defaultReturnTo;
 const emit=event=>{for(const listener of listeners){try{listener(event,session);}catch{ /* UI observers cannot authorize or block logout. */ }}};
 const random=()=>base64url(cryptoImpl.getRandomValues(new Uint8Array(32)));
 async function json(url,init={},message='SOVSI ID could not verify this request.'){
  const response=await request(url,{...OPTIONS,...init,signal:init.signal||AbortSignal.timeout(15000)});
  if(!response.ok)fail(message);
  try{return await response.json();}catch{fail('SOVSI ID returned an unreadable response.');}
 }
 async function configuration(){
  const query=new URLSearchParams({select:'client_id,redirect_uri',portal_key:'eq.'+portalKey,enabled:'eq.true'});
  const rows=await json(SOVSI_URL+'/rest/v1/sovsi_identity_oauth_clients?'+query,{headers:{apikey:SOVSI_PUBLIC_KEY}},'This portal has not yet been registered with SOVSI ID.');
  if(!Array.isArray(rows)||rows.length!==1||!UUID.test(rows[0].client_id)||rows[0].redirect_uri!==callback)
   fail('The registered SOVSI client does not match this portal.');
  registration={clientId:rows[0].client_id,redirectUri:callback,canonicalOrigin};
  return registration;
 }
 function assertClaims(claim,userId,clientId,aal='aal2'){
  if(claim.iss!==SOVSI_ISSUER||!audience(claim.aud,'authenticated')||claim.role!=='authenticated'||
   claim.sub!==userId||!UUID.test(userId)||claim.client_id!==clientId||
   !UUID.test(claim.session_id||'')||claim.is_anonymous===true||claim.aal!==aal||
   !Number.isFinite(claim.exp)||claim.exp<=now()/1000||
   claim.nbf!==undefined&&(!Number.isFinite(claim.nbf)||claim.nbf>now()/1000+30))
   fail('A current, client-bound SOVSI identity session is required.');
 }
 async function verifyUser(token){
  const user=await json(SOVSI_ISSUER+'/user',{headers:{apikey:SOVSI_PUBLIC_KEY,Authorization:'Bearer '+token}},'Your SOVSI session could not be verified. Sign in again.');
  if(!UUID.test(user?.id||'')||!user.email_confirmed_at||user.is_anonymous===true)
   fail('A confirmed SOVSI account is required.');
  return user;
 }
 async function verifyIdToken(token,tx,userId){
  const parts=token.split('.');
  if(parts.length!==3||token.length>20000)fail('The OpenID Connect token is invalid.');
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  if(!['RS256','ES256'].includes(header.alg)||typeof header.kid!=='string'||header.jku||header.jwk||header.x5u||header.crit||header.b64===false)
   fail('The OpenID Connect signing algorithm is not allowed.');
  if(!jwks||now()-jwksAt>300000){jwks=await json(SOVSI_ISSUER+'/.well-known/jwks.json');jwksAt=now();}
  let keys=Array.isArray(jwks?.keys)?jwks.keys:[];
  let key=keys.find(k=>k.kid===header.kid&&(!k.alg||k.alg===header.alg));
  if(!key){jwks=await json(SOVSI_ISSUER+'/.well-known/jwks.json');jwksAt=now();keys=jwks?.keys||[];key=keys.find(k=>k.kid===header.kid&&(!k.alg||k.alg===header.alg));}
  if(!key||key.use&&key.use!=='sig'||key.d)fail('The OpenID Connect signing key is not trusted.');
  const algorithm=header.alg==='RS256'?{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}:{name:'ECDSA',namedCurve:'P-256'};
  const imported=await cryptoImpl.subtle.importKey('jwk',key,algorithm,false,['verify']);
  const valid=await cryptoImpl.subtle.verify(header.alg==='RS256'?algorithm:{name:'ECDSA',hash:'SHA-256'},imported,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  if(!valid)fail('The OpenID Connect signature could not be verified.');
  const claim=claimsOf(token);
  if(claim.iss!==SOVSI_ISSUER||!(claim.aud===tx.clientId||Array.isArray(claim.aud)&&claim.aud.length===1&&claim.aud[0]===tx.clientId)||claim.sub!==userId||claim.nonce!==tx.nonce||claim.azp!==undefined&&claim.azp!==tx.clientId||
   !Number.isFinite(claim.exp)||claim.exp<=now()/1000||claim.nbf!==undefined&&(!Number.isFinite(claim.nbf)||claim.nbf>now()/1000+30))
   fail('The OpenID Connect nonce, issuer or subject did not match.');
 }
 async function live(token){
  const alive=await json(SOVSI_URL+'/rest/v1/rpc/sovsi_portal_session_live_v1',{
   method:'POST',headers:{apikey:SOVSI_PUBLIC_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({p_portal_key:portalKey})
  },'Your SOVSI session or portal access is no longer active.');
  if(alive!==true)fail('Your SOVSI session or portal access is no longer active.');
 }
 async function validate(tokens,expected){
  if(!tokens?.access_token||typeof tokens.refresh_token!=='string'||!tokens.refresh_token)fail('The SOVSI application session is incomplete.');
  const config=registration||await configuration();
  const user=await verifyUser(tokens.access_token),claim=claimsOf(tokens.access_token);
  assertClaims(claim,user.id,config.clientId);
  if(expected&&(claim.sub!==expected.sub||claim.session_id!==expected.session_id))fail('The refreshed identity session changed. Sign in again.');
  if(!user.factors?.some(f=>f.status==='verified'&&f.factor_type==='totp'))fail('A verified SOVSI authenticator is required.');
  await live(tokens.access_token);
  const verified={access_token:tokens.access_token,refresh_token:tokens.refresh_token,user,identitySubject:user.id,expires_at:claim.exp,client_id:config.clientId,session_id:claim.session_id};
  if(!authorize)return verified;
  const mapped=await authorize(verified);
  if(!mapped||mapped.identitySubject!==verified.identitySubject||mapped.access_token!==verified.access_token||
   mapped.refresh_token!==verified.refresh_token||mapped.client_id!==verified.client_id||!mapped.user?.id)
   fail('The application account link could not be verified.');
  return mapped;
 }
 function clear(){session=null;storage().removeItem(storageKey);emit('SIGNED_OUT');}
 async function accept(tokens,expected,event='SIGNED_IN',version=generation){
  const checked=await validate(tokens,expected);
  if(version!==generation)fail('Sign-in was cancelled.');
  storage().setItem(storageKey,JSON.stringify({access_token:checked.access_token,refresh_token:checked.refresh_token}));
  session=checked;emit(event);return checked;
 }
 async function refresh(tokens){
  const config=registration||await configuration();
  if(!tokens.refresh_token)fail('Your session expired. Sign in again.');
  return json(SOVSI_ISSUER+'/oauth/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({grant_type:'refresh_token',client_id:config.clientId,refresh_token:tokens.refresh_token})
  },'Your SOVSI session could not be renewed. Sign in again.');
 }
 async function getSession(forceRefresh=false){
  if(restoring)return restoring;
  const version=generation;
  restoring=(async()=>{
   try{
    const saved=storage().getItem(storageKey);if(!saved)return null;
    let tokens=JSON.parse(saved),prior=claimsOf(tokens.access_token);
    await configuration();
    if(forceRefresh||!prior.exp||prior.exp<=now()/1000+60)tokens=await refresh(tokens);
    return await accept(tokens,prior,'TOKEN_REFRESHED',version);
   }catch(error){if(version===generation)clear();throw error;}
  })();
  try{return await restoring;}finally{restoring=null;}
 }
 async function begin(returnTo=defaultReturnTo){
  const version=++generation;
  const config=await configuration();
  if(version!==generation)fail('Sign-in was cancelled.');
  if(environment.location.origin!==canonicalOrigin)fail('Open '+origin.host+' to sign in securely.');
  const tx={state:random(),nonce:random(),verifier:random(),createdAt:now(),clientId:config.clientId,redirectUri:callback,returnTo:safeReturn(returnTo)};
  const hash=await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(tx.verifier));
  const url=new URL(SOVSI_ISSUER+'/oauth/authorize');
  url.search=new URLSearchParams({response_type:'code',client_id:tx.clientId,redirect_uri:callback,scope:'openid email',state:tx.state,nonce:tx.nonce,code_challenge:base64url(new Uint8Array(hash)),code_challenge_method:'S256'}).toString();
  if(version!==generation)fail('Sign-in was cancelled.');
  storage().setItem(transactionKey,JSON.stringify(tx));
  environment.location.assign(url.href);
 }
 async function complete(params=new URLSearchParams(environment.location.search)){
  const completionVersion=generation;
  if(environment.location.origin!==canonicalOrigin||environment.location.pathname!=='/identity/oauth/callback')fail('This is not the registered SOVSI callback.');
  // Remove authorization codes from history even when processing fails.
  environment.history?.replaceState(null,'','/identity/oauth/callback');
  const saved=storage().getItem(transactionKey);storage().removeItem(transactionKey);
  if(!saved)fail('No matching sign-in request. Restart from your portal.');
  const tx=JSON.parse(saved),state=params.get('state');
  if(params.getAll('state').length!==1||!state||tx.state!==state||!tx.nonce||!tx.verifier||
   !Number.isFinite(tx.createdAt)||now()-tx.createdAt>600000||tx.createdAt>now()+30000)
   fail('This sign-in request is invalid or expired. Restart from your portal.');
  const config=await configuration();
  if(tx.clientId!==config.clientId||tx.redirectUri!==callback)fail('The portal registration changed during sign-in.');
  if(params.has('error'))fail('SOVSI authorization was declined or cancelled.');
  const code=params.get('code');if(params.getAll('code').length!==1||!code||code.length>2048)fail('The authorization code is missing or invalid.');
  const tokens=await json(SOVSI_ISSUER+'/oauth/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({grant_type:'authorization_code',code,client_id:config.clientId,redirect_uri:callback,code_verifier:tx.verifier})
  },'SOVSI ID rejected the authorization code. Restart sign-in.');
  if(!tokens?.access_token||!tokens.id_token||!tokens.refresh_token)fail('A complete signed OAuth session is required.');
  const user=await verifyUser(tokens.access_token),claim=claimsOf(tokens.access_token);
  assertClaims(claim,user.id,config.clientId,claim.aal==='aal1'?'aal1':'aal2');
  await verifyIdToken(tokens.id_token,tx,user.id);
  const finish=async current=>({kind:'verified',session:await accept(current,claim,'SIGNED_IN',completionVersion),returnTo:safeReturn(tx.returnTo)});
  if(claim.aal==='aal2')return finish(tokens);
  const factor=user.factors?.find(f=>f.factor_type==='totp'&&f.status==='verified');
  if(!factor)fail('Set up your SOVSI authenticator at auth.sovsi.xyz/security, then restart sign-in.');
  let pending=tokens.access_token;const deadline=now()+300000;
  tokens.access_token='';tokens.refresh_token='';tokens.id_token='';
  const version=completionVersion;let cancelled=false;
  const cancel=()=>{pending='';cancelled=true;if(version===generation)generation++;};
  return {kind:'challenge',email:user.email||'SOVSI account',cancel,verify:async code=>{
   if(!/^\d{6}$/.test(code))fail('Enter the six-digit SOVSI authenticator code.');
   if(!pending||now()>deadline||version!==generation){cancel();fail('The MFA request expired. Restart sign-in.');}
   const initial=pending;pending='';
   const headers={'Content-Type':'application/json',apikey:SOVSI_PUBLIC_KEY,Authorization:'Bearer '+initial};
   const path=SOVSI_ISSUER+'/factors/'+encodeURIComponent(factor.id);
   const challenge=await json(path+'/challenge',{method:'POST',headers,body:'{}'},'Unable to start the SOVSI authenticator challenge.');
   if(!challenge.id)fail('The authenticator challenge was invalid.');
   const upgraded=await json(path+'/verify',{method:'POST',headers,body:JSON.stringify({challenge_id:challenge.id,code})},'The authenticator code was not accepted. Restart sign-in.');
   const upgradedUser=await verifyUser(upgraded.access_token),mfa=claimsOf(upgraded.access_token);
   // MFA may omit client_id. Never store/authorize this intermediate token.
   if(upgradedUser.id!==user.id||mfa.iss!==SOVSI_ISSUER||!audience(mfa.aud,'authenticated')||mfa.sub!==claim.sub||
    mfa.session_id!==claim.session_id||mfa.role!=='authenticated'||mfa.aal!=='aal2'||!Number.isFinite(mfa.exp)||mfa.exp<=now()/1000)
    fail('MFA changed the identity session. Restart sign-in.');
   const bound=await refresh(upgraded);upgraded.access_token='';upgraded.refresh_token='';
   if(cancelled||version!==generation)fail('Sign-in was cancelled.');
   return finish(bound);
  }};
 }
 async function signOut(){
  let token=session?.access_token;
  if(!token){try{token=JSON.parse(storage().getItem(storageKey)||'null')?.access_token;}catch{ /* Clear corrupt browser storage. */ }}
  generation++;clear();storage().removeItem(transactionKey);
  if(token)await request(SOVSI_ISSUER+'/logout?scope=local',{...OPTIONS,method:'POST',headers:{apikey:SOVSI_PUBLIC_KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)}).catch(()=>{});
 }
 return {configuration,begin,complete,getSession,getAccessToken:async()=> (await getSession())?.access_token||null,signOut,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}};
}
