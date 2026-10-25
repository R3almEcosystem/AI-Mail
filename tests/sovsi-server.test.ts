// @vitest-environment node
import { beforeAll,beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { generateKeyPair,exportJWK,SignJWT } from 'jose';
import { verifySovsiAccess,SOVSI_ISSUER } from '../src/lib/sovsi-server';
let privateKey:CryptoKey,jwk:Record<string,unknown>;
const subject='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222',clientId='33333333-3333-4333-8333-333333333333';
let live:unknown=true,confirmed=true,factor=true;
beforeAll(async()=>{const pair=await generateKeyPair('ES256');privateKey=pair.privateKey;jwk={...await exportJWK(pair.publicKey),kid:'synthetic',alg:'ES256',use:'sig'};});
beforeEach(()=>{live=true;confirmed=true;factor=true;vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
 const url=String(input);if(url.endsWith('/.well-known/jwks.json'))return Response.json({keys:[jwk]});
 if(url.includes('sovsi_identity_oauth_clients?'))return Response.json([{client_id:clientId,redirect_uri:'https://ai-mail.sovsi.xyz/identity/oauth/callback'}]);
 if(url.endsWith('/user'))return Response.json({id:subject,email:'admin@example.test',email_confirmed_at:confirmed?'2026-01-01':null,factors:factor?[{status:'verified',factor_type:'totp'}]:[]});
 if(url.endsWith('/sovsi_portal_session_live_v1'))return Response.json(live);
 throw Error('Unexpected test network call '+url);
}));});
afterEach(()=>vi.unstubAllGlobals());
async function token(overrides:Record<string,unknown>={}){return new SignJWT({iss:SOVSI_ISSUER,sub:subject,aud:'authenticated',role:'authenticated',client_id:clientId,session_id:sessionId,aal:'aal2',exp:Math.floor(Date.now()/1000)+300,...overrides}).setProtectedHeader({alg:'ES256',kid:'synthetic'}).sign(privateKey);}
describe('SOVSI server access boundary',()=>{
 it('accepts a signed exact-client live AAL2 identity',async()=>{expect(await verifySovsiAccess(await token(),'ai-mail')).toMatchObject({subject,sessionId,clientId});});
 for(const claim of [{iss:'https://untrusted.example'},{client_id:'44444444-4444-4444-8444-444444444444'},{aal:'aal1'},{role:'service_role'},{exp:1},{sub:'not-uuid'},{session_id:null},{is_anonymous:true}])it('rejects mismatched claims '+JSON.stringify(claim),async()=>{await expect(verifySovsiAccess(await token(claim),'ai-mail')).rejects.toBeDefined();});
 for(const value of [false,'true',null,{live:true}])it('requires literal true central liveness '+JSON.stringify(value),async()=>{live=value;await expect(verifySovsiAccess(await token(),'ai-mail')).rejects.toBeDefined();});
 it('rejects an unconfirmed account',async()=>{confirmed=false;await expect(verifySovsiAccess(await token(),'ai-mail')).rejects.toBeDefined();});
 it('rejects missing verified authenticator',async()=>{factor=false;await expect(verifySovsiAccess(await token(),'ai-mail')).rejects.toBeDefined();});
 it('rejects a forged signature',async()=>{const original=await token();const parts=original.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);await expect(verifySovsiAccess(parts.join('.'),'ai-mail')).rejects.toBeDefined();});
});
