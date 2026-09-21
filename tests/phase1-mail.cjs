const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./module-loader.cjs');
function fixtures(options = {}) {
  const events=[]; let rawFetches=0, sends=0;
  class ImapFlow {
    async connect() { events.push('connect'); if(options.connectFails) throw new Error('connect failed'); }
    async getMailboxLock() { if(options.lockFails) throw new Error('lock failed'); return {release:()=>events.push('release')}; }
    async logout() { events.push('logout'); }
    close() { events.push('close'); }
    async operation() { await new Promise(resolve=>setImmediate(resolve)); events.push('complete'); if(options.operationRejects) throw new Error('operation failed'); return options.operationFalse ? false : true; }
    async messageFlagsAdd() { return this.operation(); }
    async messageFlagsRemove() { return this.operation(); }
    async messageMove() { return this.operation(); }
    async fetchOne(uid, what) { if(what.source) rawFetches++; return {uid, size:20_000_000, source:Buffer.from('test'), envelope:{from:[{address:'source@example.test'}]}, flags:new Set()}; }
    async list() { return [{path:'Sent',specialUse:'\\Sent'}]; }
    async append() { return options.appendFalse ? false : {uid:55}; }
  }
  const mailer={ createTransport: (config)=>({sendMail:async()=> {
    if(config.streamTransport)return {message:Buffer.from('fixture mime')};
    sends++; return {messageId:'test-message',accepted:['approved@example.test'],rejected:[],response:'250 OK'};
  },verify:async()=>true})};
  const overrides={'imapflow':{ImapFlow},'nodemailer':mailer,'mailparser':{simpleParser:async()=>({text:'test',attachments:[]})},'postal-mime':{parse:async()=>({text:'test',headers:[],attachments:[]})}};
  return { overrides, events, rawFetches:()=>rawFetches, sends:()=>sends };
}
Object.assign(process.env,{MAIL_USERNAME:'sender@example.test',MAIL_PASSWORD:'test-only',IMAP_HOST:'imap.example.test',SMTP_HOST:'smtp.example.test',OUTBOUND_ALLOWED_DOMAINS:'example.test'});
for(const action of ['read','unread','flag','unflag','archive']) {
  test(`${action} completes before IMAP release and logout`, async()=>{
    const f=fixtures(); const mail=loadModule('src/lib/mail.ts',f.overrides);
    await mail.updateMail(1,action); assert.ok(f.events.indexOf('complete')<f.events.indexOf('release'),JSON.stringify(f.events));
    assert.ok(f.events.indexOf('complete')<f.events.indexOf('logout'));
  });
  test(`${action} rejects a false IMAP result`,async()=>{
    const f=fixtures({operationFalse:true});
    await assert.rejects(loadModule('src/lib/mail.ts',f.overrides).updateMail(1,action));
  });
}
test('mailbox lock failures still clean up the connection',async()=>{
  const f=fixtures({lockFails:true});
  await assert.rejects(loadModule('src/lib/mail.ts',f.overrides).updateMail(1,'read'));
  assert.ok(f.events.includes('logout')||f.events.includes('close'));
});
test('browser send blocks recipients outside the configured domain before SMTP',async()=>{
  const f=fixtures();
  await assert.rejects(loadModule('src/lib/mail.ts',f.overrides).sendMail({to:'outside@blocked.test',subject:'Test',text:'Test'}));
  assert.equal(f.sends(),0);
});
test('browser read rejects oversized metadata before fetching raw MIME',async()=>{
  const f=fixtures();
  await assert.rejects(loadModule('src/lib/mail.ts',f.overrides).getMail(1));
  assert.equal(f.rawFetches(),0);
});
module.exports = { fixtures };
