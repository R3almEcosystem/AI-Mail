import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSendResult } from '../../src/lib/send-result.ts';
test('a confirmed live receipt is accepted',()=>assert.deepEqual(parseSendResult(true,{ok:true,demo:false,messageId:'<id>',accepted:['a@example.com']}),{state:'accepted',demo:false}));
test('demo acknowledgement remains explicitly demo',()=>assert.deepEqual(parseSendResult(true,{ok:true,demo:true,messageId:'demo-message'}),{state:'accepted',demo:true}));
test('malformed or incomplete success is uncertain, never sent',()=>{
  for(const value of [null,{}, {ok:true},{ok:true,demo:false,messageId:'id'}, {ok:true,demo:false,messageId:'id',accepted:[]}])assert.equal(parseSendResult(true,value).state,'uncertain');
});
test('security rejection retains bounded reason text',()=>{
  const result=parseSendResult(false,{error:'Blocked',code:'EMAIL_SECURITY_BLOCKED',security:{findings:[{message:'Potential private-key material detected.'}]}});
  assert.equal(result.state,'rejected');assert.deepEqual(result.findings,['Potential private-key material detected.']);
});
test('malformed findings cannot crash compose error handling',()=>{
  for(const security of [null,{findings:1},{findings:[null,{}, {message:42}]}]) assert.equal(parseSendResult(false,{code:'EMAIL_SECURITY_BLOCKED',security}).state,'rejected');
});
test('a non-OK HTTP status is never accepted even with a spoofed success body',()=>assert.equal(parseSendResult(false,{ok:true,demo:false,messageId:'id',accepted:['a@example.com']}).state,'rejected'));
