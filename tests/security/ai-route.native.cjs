const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const load=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');const requests=load(path.join(root,'src/lib/ai-request.ts'));
function fixture({authorized=true,demo=false,configured=true}={}){
 let reads=0,calls=0;
 const api=load(path.join(root,'src/app/api/ai/route.ts'),{
  'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
  '@/lib/ai':{aiConfiguration:()=>({configured,model:'fixture'}),analyzeMail:async(_action,message)=>{calls++;assert.equal(message.body,'server-owned message');return{text:'summary',usage:{},truncated:false};}},
  '@/lib/mail':{getMail:async(uid,folder)=>{reads++;assert.equal(uid,12);assert.equal(folder,'INBOX');return{body:'server-owned message'};}},
  '@/lib/session':{requireCapability:async()=>{if(!authorized)throw Error('FORBIDDEN');return{demo,role:'member'};}},
  '@/lib/auth-policy':{can:()=>true},'@/lib/ai-request':requests,
  '@/lib/api-error':{privateHeaders:{'Cache-Control':'private, no-store'},apiError:error=>Response.json({error:'Unavailable'},{status:error.message==='FORBIDDEN'?403:502})},
 });return {...api,reads:()=>reads,calls:()=>calls};
}
const request=body=>new Request('https://ai-mail.r3alm.com/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
test('unauthorized AI requests do not read request content, IMAP or AI',async()=>{const f=fixture({authorized:false}),r=request({action:'summarize',uid:12});assert.equal((await f.POST(r)).status,403);assert.equal(r.bodyUsed,false);assert.equal(f.reads(),0);assert.equal(f.calls(),0);});
test('forged browser message content is rejected rather than sent to AI',async()=>{const f=fixture();assert.equal((await f.POST(request({action:'summarize',uid:12,message:{body:'forged'}}))).status,400);assert.equal(f.reads(),0);assert.equal(f.calls(),0);});
test('live analysis uses only the server mailbox snapshot and returns its UID',async()=>{const f=fixture();const response=await f.POST(request({action:'summarize',uid:12}));assert.equal(response.status,200);assert.equal((await response.json()).uid,12);assert.equal(f.reads(),1);assert.equal(f.calls(),1);});
test('demo and missing AI configuration never touch live mailbox/scanner/provider',async()=>{for(const [options,status] of [[{demo:true},200],[{configured:false},503]]){const f=fixture(options);assert.equal((await f.POST(request({action:'summarize',uid:12}))).status,status);assert.equal(f.reads(),0);assert.equal(f.calls(),0);}});
