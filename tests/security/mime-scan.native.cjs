const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const load=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');const rules=load(path.join(root,'src/security/email-security.ts'));const scan=load(path.join(root,'src/security/attachment-scan.ts'));
function fixture({required=false,status='clean',text='Hello',html='',attachments=[{filename:'report.txt',mimeType:'text/plain',content:new TextEncoder().encode('private-file-bytes').buffer}]}={}){
 let closed=false,calls=0;class ImapFlow{async connect(){} async logout(){closed=true;}close(){closed=true;}async getMailboxLock(){return{release(){}};}async fetchOne(uid,fields){return fields.size?{size:50}:{uid,source:Buffer.from('fixture'),flags:new Set(),envelope:{subject:'Report',from:[{address:'sender@example.com'}],to:[]}};}}
 const policy=required?{mode:'required',scanner:{id:'fixture',scan:async()=>{assert.equal(closed,true,'Do not hold the mailbox connection during provider scanning');calls++;return{status};}}}:{mode:'disabled'};
 const {MailGateway}=load(path.join(root,'src/mail/client.ts'),{imapflow:{ImapFlow},nodemailer:{},'postal-mime':{parse:async()=>({text,html,headers:[],attachments})},
  '../security/email-security.js':rules,'../security/attachment-scan.js':{...scan,attachmentPolicyFromEnv:()=>policy},
  './address.js':{envelopeAddresses:value=>value??[]},'./sanitize.js':{normalizeMessageId:value=>value,clampText:(value,max)=>value.slice(0,max)},'./policy.js':{assertMessageIdentity(){}}});
 const gateway=new MailGateway({imap:{host:'mail.example.com',port:993,secure:true},smtp:{},mail:{username:'sender@example.com',password:'synthetic'},limits:{maxRawMessageBytes:10000,maxMessageBodyChars:100}});
 return{read:()=>gateway.getMessage('INBOX',1),calls:()=>calls};
}
test('default MIME reads do not submit files externally and say not scanned',async()=>{const f=fixture();const result=await f.read();assert.equal(result.attachmentInspection.status,'not_scanned');assert.equal(f.calls(),0);});
test('enabled scan runs only after IMAP cleanup and returns hash evidence not bytes',async()=>{const f=fixture({required:true});const result=await f.read();assert.equal(result.attachmentInspection.status,'clean');assert.equal(f.calls(),1);assert.ok(!JSON.stringify(result).includes('private-file-bytes'));assert.ok(!('attachmentBytes' in result));});
test('blocked and errored MIME scans remain visible as non-clean evidence',async()=>{for(const status of ['blocked','error'])assert.equal((await fixture({required:true,status}).read()).attachmentInspection.status,status);});
test('full MIME DLP findings survive body truncation',async()=>{const result=await fixture({text:'x'.repeat(120)+' SSN: 123-45-6789'}).read();assert.equal(result.text.length,100);assert.ok(result.security.findings.some(item=>item.code==='social_security_number'));});

test('HTML-only bodies are converted to sandbox-ready network-blocked documents',async()=>{
 const malicious='<div onclick="alert(1)" style="background:url(https://tracker.example/pixel)">Hello <a href="https://evil.example/">world</a><img src="https://tracker.example/open"><script>fetch("https://evil.example")</script><form action="https://evil.example"><input name="x"></form></div>';
 const result=await fixture({text:'',html:malicious}).read();
 assert.ok(result.safeHtmlBody);
 assert.ok(result.safeHtmlBody.includes("Content-Security-Policy"));
 assert.ok(result.safeHtmlBody.includes("default-src 'none'"));
 assert.ok(!result.safeHtmlBody.includes('<script'));
 assert.ok(!result.safeHtmlBody.includes('<form'));
 assert.ok(!result.safeHtmlBody.includes('<input'));
 assert.ok(!result.safeHtmlBody.includes('onclick='));
 assert.ok(!result.safeHtmlBody.includes('href="https://'));
 assert.ok(!/<img\b[^>]*\ssrc="https:\/\//i.test(result.safeHtmlBody));
 assert.ok(!result.safeHtmlBody.includes('url(https://'));
});


test('CID images are embedded safely while remote images remain inert placeholders',async()=>{
 const png=new Uint8Array([137,80,78,71,13,10,26,10]).buffer;
 const result=await fixture({
   text:'',
   html:'<div><img src="cid:logo-image"><img src="https://images.example.test/banner.png"></div>',
   attachments:[{filename:'logo.png',mimeType:'image/png',contentId:'logo-image',related:true,content:png}]
 }).read();
 assert.ok(result.safeHtmlBody);
 assert.match(result.safeHtmlBody,/src="data:image\/png;base64,/);
 assert.match(result.safeHtmlBody,/data-remote-src="https:\/\/images\.example\.test\/banner\.png"/);
 assert.ok(!/<img\b[^>]*\ssrc="https:\/\/images\.example\.test\/banner\.png"/i.test(result.safeHtmlBody));
 assert.ok(!result.safeHtmlBody.includes('cid:logo-image'));
});
