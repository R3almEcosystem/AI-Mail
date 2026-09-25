const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const load=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');const rules=load(path.join(root,'src/security/email-security.ts'));
const guard=load(path.join(root,'src/security/ai-disclosure.ts'),{'./email-security.js':rules});
const input=(text='Meeting confirmed')=>({sender:'Example',senderEmail:'a@example.com',subject:'Meeting',preview:text,body:text,attachments:0,
 security:rules.assessEmailSecurity({direction:'inbound',subject:'Meeting',text}),attachmentInspection:{required:false,status:'no_attachments',provider:null,files:[]}});
function fixture(result='Meeting summary'){
 let calls=0,options;
 const api=load(path.join(root,'src/lib/ai.ts'),{'server-only':{},'@ai-sdk/openai':{openai:model=>model},ai:{generateText:async value=>{calls++;options=value;return{text:result,usage:{totalTokens:5}};}},'../security/ai-disclosure':guard});
 return {...api,calls:()=>calls,options:()=>options};
}
const originalKey=process.env.OPENAI_API_KEY,originalModel=process.env.OPENAI_MODEL;
process.env.OPENAI_API_KEY='synthetic';process.env.OPENAI_MODEL='synthetic-model';
process.on('exit',()=>{if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;if(originalModel===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=originalModel;});
test('detected private data causes zero AI provider calls',async()=>{const f=fixture();await assert.rejects(()=>f.analyzeMail('summarize',input('SSN: 123-45-6789')),/AI_SECURITY_BLOCKED/);assert.equal(f.calls(),0);});
test('generation separates system instructions, sends no tools and bounds retries/output/time',async()=>{
 const f=fixture();const result=await f.analyzeMail('summarize',input());assert.equal(result.text,'Meeting summary');assert.equal(f.calls(),1);
 const options=f.options();assert.ok(options.system.includes('untrusted'));assert.equal(options.maxRetries,0);assert.equal(options.maxOutputTokens,1000);assert.ok(options.abortSignal instanceof AbortSignal);assert.equal(options.tools,undefined);
});
test('provider-generated sensitive output is withheld',async()=>{const f=fixture('SSN: 123-45-6789');await assert.rejects(()=>f.analyzeMail('summarize',input()),/AI_SECURITY_BLOCKED/);assert.equal(f.calls(),1);});
