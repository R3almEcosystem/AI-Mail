const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./load-typescript.cjs');
const root = path.resolve(__dirname, '../..');
const security = load(path.join(root, 'src/security/email-security.ts'));
function fixture(parsed = {}) {
  let smtpCalls = 0; let logoutCalls = 0;
  class ImapFlow {
    async connect() {} async logout() { logoutCalls++; } close() {}
    async getMailboxLock() { return { release() {} }; }
    async fetchOne(uid, options) {
      if (options.size) return { size: 50 };
      return { uid, source: Buffer.from('fixture'), flags: new Set(), envelope: {
        subject: 'Test message', from: [{ address: 'sender@example.com' }], to: [{ address: 'own@example.com' }],
      }};
    }
    async list() { return []; }
    async append() { return { uid: 2 }; }
  }
  const { MailGateway } = load(path.join(root, 'src/mail/client.ts'), {
    imapflow: { ImapFlow },
    nodemailer: { createTransport(options) {
      if (options.streamTransport) return { sendMail: async () => ({ message: Buffer.from('sent') }) };
      smtpCalls++;
      return { sendMail: async () => ({ accepted: ['to@example.com'], rejected: [], messageId: '<fixture@example.com>', response: 'accepted' }) };
    } },
    'postal-mime': { parse: async () => ({ text: 'Hello', html: '', headers: [], attachments: [], ...parsed }) },
    './address.js': { assertRecipientsAllowed() {}, envelopeAddresses: value => value ?? [], dedupeAddresses: value => [...new Set(value)] },
    './sanitize.js': { normalizeMessageId: value => value, subjectForReply: value => `Re: ${value}`, stripHeaderNewlines: value => value.replace(/[\r\n]/g,''), clampText: (value, limit) => value.slice(0,limit) },
    './policy.js': { assertMessageIdentity() {} },
    '../security/email-security.js': security,
  });
  const gateway = new MailGateway({ imap: { host:'mail.example.com',port:993,secure:true }, smtp: { host:'mail.example.com',port:465,secure:true }, mail: { username:'own@example.com',password:'synthetic' }, limits: { maxRecipients:20,maxSearchResults:50,maxRawMessageBytes:10000,maxMessageBodyChars:100,outboundAllowedDomains:[] } });
  return { gateway, smtpCalls: () => smtpCalls, logoutCalls: () => logoutCalls };
}
test('shared SMTP transport blocks DLP before even creating a transport', async () => {
  const f=fixture();
  await assert.rejects(f.gateway.sendEmail({to:['to@example.com'],subject:'Details',text:['4111','1111','1111','1111'].join(' ')}), error=>error.code==='EMAIL_SECURITY_BLOCKED');
  assert.equal(f.smtpCalls(),0);
});
test('benign shared SMTP send still sends once and keeps Sent-copy outcome', async () => {
  const f=fixture(); const result=await f.gateway.sendEmail({to:['to@example.com'],subject:'Hello',text:'Meeting confirmed.'});
  assert.equal(f.smtpCalls(),1); assert.equal(result.sentCopy.stored,true);
});
test('reply path cannot bypass the shared outbound guard', async () => {
  const f=fixture(); await assert.rejects(f.gateway.replyEmail({folder:'INBOX',uid:1,text:'SSN: 123-45-6789',replyAll:false}),error=>error.code==='EMAIL_SECURITY_BLOCKED');
  assert.equal(f.smtpCalls(),0);
});
test('inbound assessment inspects full text before display clamp', async () => {
  const f=fixture({text:'x'.repeat(110)+' urgent wire transfer today'});
  const message=await f.gateway.getMessage('INBOX',1);
  assert.equal(message.text.length,100);
  assert.ok(message.security.findings.some(finding=>finding.code==='payment_request'));
  assert.equal(f.logoutCalls(),1);
});
test('inbound assessment inspects HTML and attachment metadata without trusting auth headers', async () => {
  const f=fixture({html:'<a href="javascript:alert(1)">view</a>',attachments:[{filename:'invoice.exe',mimeType:'application/octet-stream'}],headers:[{key:'Authentication-Results',value:'attacker; dmarc=pass'}]});
  const message=await f.gateway.getMessage('INBOX',1);
  assert.equal(message.security.disposition,'block');
  assert.equal(message.security.coverage.authentication,'not_verified');
  assert.ok(message.security.findings.some(finding=>finding.code==='dangerous_attachment'));
});
test('inbound authentication is not asserted for ordinary messages either', async () => {
  const message=await fixture().gateway.getMessage('INBOX',1);
  assert.equal(message.security.disposition,'no_local_match');
  assert.equal(message.security.coverage.malware,'not_scanned');
});
