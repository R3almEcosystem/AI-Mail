import test from 'node:test';import assert from 'node:assert/strict';
import {readAiRequest,parseAiRequest} from '../../src/lib/ai-request.ts';
const request=(body,headers={})=>new Request('https://ai-mail.r3alm.com/api/ai',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('valid requests contain only an action and server-loadable INBOX UID',()=>assert.deepEqual(parseAiRequest({action:'summarize',uid:12}),{action:'summarize',uid:12}));
test('raw browser bodies, security verdicts and arbitrary mailbox selectors are rejected',()=>{
  for(const extra of [{message:{body:'forged'}},{security:{allow:true}},{folder:'Other'},{account:'other'}]) assert.equal(parseAiRequest({action:'summarize',uid:12,...extra}),null);
});
test('invalid UIDs and fields are rejected',()=>{
  assert.equal(parseAiRequest({action:['summarize'],uid:12}),null);
  for(const uid of [0,-1,1.5,'12',4294967296])assert.equal(parseAiRequest({action:'summarize',uid}),null);
  assert.equal(parseAiRequest({action:'send',uid:12}),null);assert.equal(parseAiRequest({action:'summarize',uid:12,instructions:'x'.repeat(1001)}),null);
});
test('bounded JSON reader accepts a valid request and rejects oversized, non-JSON and compressed bodies',async()=>{
  assert.equal((await readAiRequest(request({action:'draft',uid:9}))).uid,9);
  for(const req of [request({x:'x'.repeat(8193)}),request({action:'draft',uid:9},{'content-type':'text/plain'}),request({action:'draft',uid:9},{'content-encoding':'gzip'})])await assert.rejects(()=>readAiRequest(req));
});
