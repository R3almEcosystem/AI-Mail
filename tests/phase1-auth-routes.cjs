const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadModule}=require('./module-loader.cjs');
const schema=new Proxy(function(){return schema;},{get:(_,k)=>k==='safeParse'?(data)=>({success:true,data}):schema});
class NextResponse extends Response{constructor(body,init){super(body,init);this.cookieWrites=[];this.cookies={set:(...args)=>this.cookieWrites.push(args)};}static json(v,i){return new NextResponse(JSON.stringify(v),i);}}
const next={'next/server':{NextResponse},zod:{z:schema}};
const user={id:'user',name:'Synthetic',email:'synthetic@example.test',role:'member',demo:false};
function setup(options={}){
 let issued=0;
 const route=loadModule('src/app/api/auth/sovsi-session/route.ts',{...next,
 '@/lib/auth':{createSessionToken:async()=>{issued++;return 'signed';},SESSION_NAME:'session'},
 '@/lib/sovsi-server':{verifySovsiAccess:async()=>{if(options.denied)throw Error('UNAUTHORIZED');return {subject:'central-id'};}},
 '@/lib/session-store':{consumeLoginAttempt:async()=>!options.limited,createFederatedSession:async()=>{if(options.databaseDown||options.unlinked)throw Error('FORBIDDEN');return {user,duration:3600,sessionId:'test'};}}
 });
 const request=new Request('https://ai-mail.sovsi.xyz/api/auth/sovsi-session',{method:'POST',headers:{Origin:options.foreign?'https://evil.example':'https://ai-mail.sovsi.xyz'},body:JSON.stringify({access_token:'central-access',refresh_token:'central-refresh'})});
 return {route,request,issued:()=>issued};
}
test('local password endpoint cannot issue a session',async()=>{const r=await loadModule('src/app/api/auth/login/route.ts',next).POST();assert.equal(r.status,410);assert.equal((await r.json()).code,'SOVSI_ID_REQUIRED');});
for(const option of ['denied','unlinked','databaseDown','foreign'])test(`${option} issues no cookie`,async()=>{const t=setup({[option]:true});const r=await t.route.POST(t.request);assert.equal(r.status,403);assert.equal(r.cookieWrites.length,0);assert.equal(t.issued(),0);});
test('rate limit denies federated session issuance',async()=>{const t=setup({limited:true});assert.equal((await t.route.POST(t.request)).status,429);assert.equal(t.issued(),0);});
test('verified linked account receives only an HttpOnly local session cookie',async()=>{const t=setup();const r=await t.route.POST(t.request);assert.equal(r.status,200);assert.equal(t.issued(),1);assert.equal(r.cookieWrites[0][2].httpOnly,true);assert.equal(r.cookieWrites[0][1],'signed');});
for(const fail of [false,true])test(`logout ${fail?'preserves retry credential on storage failure':'revokes the database session before clearing cookie'}`,async()=>{
 const events=[];
 const route=loadModule('src/app/api/auth/logout/route.ts',{...next,'next/headers':{cookies:async()=>({get:()=>({value:'cookie'})})},'@/lib/auth':{SESSION_NAME:'session',verifySessionToken:async()=>({...user,sessionId:'test'})},'@/lib/session-store':{revokeDatabaseSession:async()=>{events.push('revoke');if(fail)throw Error('DB down');}}});
 const r=await route.POST(new Request('https://ai-mail.r3alm.com/api/auth/logout',{method:'POST',headers:{Origin:'https://ai-mail.r3alm.com'}}));
 assert.deepEqual(events,['revoke']);assert.equal(r.status,fail?503:200);assert.equal(r.cookieWrites.length,fail?0:1);
});
for(const field of ['requireMfa','allowDemoLogin'])test(`settings refuses unsafe ${field} activation before persistence`,async()=>{
 let writes=0;
 const route=loadModule('src/app/api/admin/settings/route.ts',{...next,'@/lib/session':{requireAdminUser:async()=>user,requireCapability:async()=>user},'@/lib/auth':{demoLoginEnabled:()=>false},'@/lib/admin-data':{databaseConfigured:()=>true,getSettings:async()=>({requireMfa:false,allowDemoLogin:false}),updateSettings:async data=>{writes++;return data;}}});
 const r=await route.PATCH(new Request('https://ai-mail.r3alm.com/api/admin/settings',{method:'PATCH',headers:{Origin:'https://ai-mail.r3alm.com'},body:JSON.stringify({requireMfa:false,allowDemoLogin:false,[field]:true})}));
 assert.equal(r.status,409);assert.equal(writes,0);
});
