import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectAttachments, attachmentPolicyFromEnv, createCloudmersiveScanner, attachmentCapabilities, SCAN_FLAGS } from '../../src/security/attachment-scan.ts';
const bytes = new TextEncoder().encode('synthetic harmless document');
const hash = value => createHash('sha256').update(value).digest('hex');
const policy = (scan, extra = {}) => ({ mode:'required', scanner:{ id:'fixture', scan }, timeoutMs:1000, ...extra });
const clean = () => ({ status:'clean' });
const response = extra => Response.json({ CleanResult:true, FoundViruses:[], VerifiedFileFormat:'.txt', ...Object.fromEntries(SCAN_FLAGS.map(flag=>[flag,false])), ...extra });

test('disabled scanning never opens a provider or calls a file clean', async()=>{
  let calls=0; const result=await inspectAttachments([bytes],{mode:'disabled',scanner:{id:'fixture',scan:async()=>{calls++;return clean();}}});
  assert.equal(calls,0);assert.equal(result.status,'not_scanned');assert.equal(result.required,false);
});
test('missing required provider fails closed', async()=>{
  const result=await inspectAttachments([bytes],{mode:'required'});
  assert.equal(result.status,'error');assert.equal(result.reason,'scanner_unavailable');assert.equal(result.required,true);
});
test('invalid operator mode does not silently disable policy', async()=>{
  const p=attachmentPolicyFromEnv({EMAIL_ATTACHMENT_SCANNING:'require'});
  assert.equal((await inspectAttachments([bytes],p)).status,'error');
});
test('clean verdict is bound to exact bytes and contains no file content', async()=>{
  const result=await inspectAttachments([bytes],policy(async b=>{assert.deepEqual(b,bytes);return clean();}));
  assert.equal(result.status,'clean');assert.equal(result.files[0].sha256,hash(bytes));assert.equal(result.files[0].bytes,bytes.length);
  assert.ok(!JSON.stringify(result).includes('harmless document'));
});
test('original bytes cannot be changed after scanning begins', async()=>{
  const original=Uint8Array.from(bytes);const expected=hash(original);
  const pending=inspectAttachments([original],policy(async b=>{await new Promise(r=>setTimeout(r,5));assert.equal(hash(b),expected);return clean();}));
  original.fill(0);assert.equal((await pending).files[0].sha256,expected);
});
test('provider mutation is rejected as an integrity error', async()=>{
  const result=await inspectAttachments([bytes],policy(async b=>{b.fill(0);return clean();}));
  assert.equal(result.status,'error');assert.equal(result.files[0].reason,'content_changed');
});
test('a single blocked attachment prevents a clean batch result', async()=>{
  let index=0; const result=await inspectAttachments([bytes,bytes],policy(async()=>++index===1?clean():{status:'blocked'}));
  assert.equal(result.status,'blocked');assert.equal(result.files.length,2);
});
test('throwing provider diagnostics are redacted', async()=>{
  const result=await inspectAttachments([bytes],policy(async()=>{throw Error('Apikey: do-not-leak document content');}));
  assert.equal(result.status,'error');assert.ok(!JSON.stringify(result).includes('do-not-leak'));
});
test('malformed and invented verdicts are not clean', async()=>{
  for(const verdict of [null,{},true,{status:'pending'},{status:'clean',allow:true}]){
    const result=await inspectAttachments([bytes],policy(async()=>verdict));
    if(verdict?.status==='clean') assert.equal(result.status,'clean');else assert.equal(result.status,'error');
  }
});
test('oversized files, too many files, invalid content and zero bytes produce no provider calls', async()=>{
  let calls=0;for(const value of [[new Uint8Array(1048577)],Array(5).fill(bytes),['base64'],[new Uint8Array(0)]]){
    const result=await inspectAttachments(value,policy(async()=>{calls++;return clean();}));assert.equal(result.status,'blocked');
  }assert.equal(calls,0);
});
test('no attachments are distinguished from scanned attachments', async()=>{
  const result=await inspectAttachments([],{mode:'required'});assert.equal(result.status,'no_attachments');assert.equal(result.files.length,0);
});
test('uncooperative scanner cannot exceed the configured request deadline', async()=>{
  const result=await inspectAttachments([bytes],policy(async()=>new Promise(()=>{}),{timeoutMs:20}));
  assert.equal(result.status,'error');assert.equal(result.files[0].reason,'scan_timeout');
});
test('capabilities never expose credential material or imply runtime health',()=>{
  const result=attachmentCapabilities({EMAIL_ATTACHMENT_SCANNING:'required',CLOUDMERSIVE_API_KEY:'test-private-key'});
  assert.equal(result.configured,true);assert.equal(result.required,true);assert.equal(result.health,'not_probed');
  assert.ok(!JSON.stringify(result).includes('test-private-key'));
});
test('Cloudmersive adapter posts only to a fixed origin, forbids redirects and removes original filenames',async()=>{
  let calls=0; const scanner=createCloudmersiveScanner('synthetic-key',async(url,options)=>{
    calls++; assert.equal(url,'https://api.cloudmersive.com/virus/scan/file/advanced');assert.equal(options.redirect,'error');
    assert.equal(options.headers.Apikey,'synthetic-key');assert.equal(options.headers.allowPasswordProtectedFiles,'false');
    const file=options.body.get('inputFile');assert.equal(file.name,'attachment.bin');assert.equal(hash(new Uint8Array(await file.arrayBuffer())),hash(bytes));
    return response();
  });assert.deepEqual(await scanner.scan(bytes,new AbortController().signal),{status:'clean'});assert.equal(calls,1);
});
test('Cloudmersive accepts explicit positive clean evidence, including documented null virus list',async()=>{
  for(const extra of [{},{FoundViruses:null}]){
    const scanner=createCloudmersiveScanner('synthetic',async()=>response(extra));assert.equal((await scanner.scan(bytes,new AbortController().signal)).status,'clean');
  }
});
test('Cloudmersive never accepts missing booleans, string booleans, unknown formats or contradictory evidence',async()=>{
  for(const extra of [{CleanResult:'true'},{ContainsMacros:undefined},{ContainsMacros:'false'},{VerifiedFileFormat:null},{FoundViruses:'none'}]){
    const scanner=createCloudmersiveScanner('synthetic',async()=>response(extra));assert.equal((await scanner.scan(bytes,new AbortController().signal)).status,'error');
  }
  for(const extra of [{CleanResult:false},{ContainsPasswordProtectedFile:true},{ContainsExecutable:true},{FoundViruses:[{VirusName:'sensitive-name'}]}]){
    const scanner=createCloudmersiveScanner('synthetic',async()=>response(extra));assert.equal((await scanner.scan(bytes,new AbortController().signal)).status,'blocked');
  }
});
test('provider HTTP failures, oversized responses and invalid JSON never become clean',async()=>{
  for(const make of [()=>new Response('secret',{status:429}),()=>new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}}),()=>new Response('{bad',{headers:{'content-type':'application/json'}}),()=>new Response('ok',{headers:{'content-type':'text/html'}})]){
    const scanner=createCloudmersiveScanner('synthetic',async()=>make());assert.equal((await scanner.scan(bytes,new AbortController().signal)).status,'error');
  }
});

test('coercible objects cannot masquerade as a scanner status', async()=>{
  for(const status of [new String('clean'),{toString:()=> 'clean'}]) {
    const result=await inspectAttachments([bytes],policy(async()=>({status})));
    assert.equal(result.status,'error');assert.equal(result.files[0].status,'error');
  }
});
