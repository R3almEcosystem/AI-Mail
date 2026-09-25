// Only authorization/orchestration is tested with the schema adapter below; these checks do not establish Zod input-validation coverage.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./module-loader.cjs');
const schema = new Proxy(function(){return schema;}, {get:(_,key)=>key==='safeParse'?(data)=>({success:true,data}):schema});
class NextResponse extends Response { constructor(body,init){super(body,init);this.cookies={set(){}};} static json(value,init){return new NextResponse(JSON.stringify(value),init);} }
const next={'next/server':{NextResponse},zod:{z:schema}};
function authFor(role='member',demo=false){
  return loadModule('src/lib/session.ts',{
    'next/headers':{cookies:async()=>({get:()=>({value:'test-cookie'})})},
    '@/lib/auth':{SESSION_NAME:'test',verifySessionToken:async()=>({id:'test',name:'Tester',email:'test@example.test',role,demo,sessionId:'a'.repeat(64),version:2}),demoLoginEnabled:()=>true},
    '@/lib/session-store':{findActiveSession:async()=>({id:'test',name:'Tester',email:'test@example.test',role,demo})},
  });
}
const request=()=>new Request('https://ai-mail.r3alm.com/api/mail/send',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://ai-mail.r3alm.com'},body:JSON.stringify({to:'test@example.test',subject:'Synthetic',text:'Synthetic test'})});
for(const [role,status] of [['viewer',403],['member',200],['manager',200],['admin',200],['super_admin',200]]) {
  test(`browser send ${role} returns ${status} before prohibited SMTP calls`,async()=>{
    let calls=0;
    const route=loadModule('src/app/api/mail/send/route.ts',{...next,'@/lib/session':authFor(role),'@/lib/mail':{mailConfiguration:()=>({smtp:true}),sendMail:async()=>{calls++;return {messageId:'test'};}}});
    const response=await route.POST(request());assert.equal(response.status,status);assert.equal(calls,status===200?1:0);
  });
}
test('live send without configuration is unavailable, not simulated success',async()=>{
  const route=loadModule('src/app/api/mail/send/route.ts',{...next,'@/lib/session':authFor(),'@/lib/mail':{mailConfiguration:()=>({smtp:false}),sendMail:async()=>{throw new Error('must not call');}}});
  assert.equal((await route.POST(request())).status,503);
});
test('demo send never calls SMTP even with a live-shaped adapter',async()=>{
  let calls=0;
  const route=loadModule('src/app/api/mail/send/route.ts',{...next,'@/lib/session':authFor('super_admin',true),'@/lib/mail':{mailConfiguration:()=>({smtp:true}),sendMail:async()=>{calls++;return {};}}});
  assert.equal((await route.POST(request())).status,200);assert.equal(calls,0);
});
test('cross-origin browser send is rejected',async()=>{
  let calls=0;
  const route=loadModule('src/app/api/mail/send/route.ts',{...next,'@/lib/session':authFor(),'@/lib/mail':{mailConfiguration:()=>({smtp:true}),sendMail:async()=>{calls++;return {};}}});
  const req=new Request(request(),{headers:{'Origin':'https://other.r3alm.com'}});
  assert.equal((await route.POST(req)).status,403);assert.equal(calls,0);
});
