const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadModule}=require('./module-loader.cjs');
const schema=new Proxy(function(){return schema;},{get:(_,k)=>k==='safeParse'?(data)=>({success:true,data}):schema});
class NextResponse extends Response{constructor(body,init){super(body,init);this.cookieWrites=[];this.cookies={set:(...args)=>this.cookieWrites.push(args)};}static json(v,i){return new NextResponse(JSON.stringify(v),i);}}
const next={'next/server':{NextResponse},zod:{z:schema}};
const user={id:'user',name:'Synthetic',email:'synthetic@example.test',role:'member',demo:false};
function setup(options={}){
 let issued=0;
 const route=loadModule('src/app/api/auth/login/route.ts',{...next,
  '@/lib/auth':{authenticationConfigured:()=>true,createSessionToken:async()=>{issued++;return 'signed';},SESSION_NAME:'session'},
  '@/lib/admin-data':{findUserForLogin:async()=>options.missing?null:{user,status:options.status||'active',passwordHash:'hash'},verifyPassword:async()=>!options.badPassword,getSettings:async()=>({requireMfa:Boolean(options.mfa),sessionTimeoutMinutes:60}),recordLogin:async()=>{}},
  '@/lib/session-store':{consumeLoginAttempt:async()=>!options.limited,createDatabaseSession:async()=>{if(options.databaseDown)throw Error('DB down');return 'session-id';}}
 });
 const request=new Request('https://ai-mail.r3alm.com/api/auth/login',{method:'POST',headers:{Origin:'https://ai-mail.r3alm.com'},body:JSON.stringify({email:user.email,password:'shared-test-password'})});
 return {route,request,issued:()=>issued};
}
for(const state of ['suspended','deleted','invited'])test(`${state} account cannot obtain a browser session`,async()=>{const t=setup({status:state});assert.equal((await t.route.POST(t.request)).status,401);assert.equal(t.issued(),0);});
test('shared password cannot override an individual account failure',async()=>{const old=process.env.APP_ACCESS_PASSWORD;process.env.APP_ACCESS_PASSWORD='shared-test-password';try{const t=setup({badPassword:true});assert.equal((await t.route.POST(t.request)).status,401);assert.equal(t.issued(),0);}finally{if(old===undefined)delete process.env.APP_ACCESS_PASSWORD;else process.env.APP_ACCESS_PASSWORD=old;}});
test('MFA-required password login fails closed',async()=>{const t=setup({mfa:true});const r=await t.route.POST(t.request);assert.equal(r.status,403);assert.equal((await r.json()).code,'MFA_REQUIRED');assert.equal(t.issued(),0);});
test('rate-limited login does not create a session',async()=>{const t=setup({limited:true});assert.equal((await t.route.POST(t.request)).status,429);assert.equal(t.issued(),0);});
test('storage failure issues no cookie',async()=>{const t=setup({databaseDown:true});const r=await t.route.POST(t.request);assert.equal(r.status,503);assert.equal(r.cookieWrites.length,0);});
test('active individual account receives a cookie only after session creation',async()=>{const t=setup();const r=await t.route.POST(t.request);assert.equal(r.status,200);assert.equal(t.issued(),1);assert.equal(r.cookieWrites.length,1);});
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
