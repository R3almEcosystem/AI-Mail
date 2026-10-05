const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./module-loader.cjs');

const research = loadModule('src/lib/mail-research.ts', {
  '@/lib/ai': { aiConfiguration: async () => ({ configured: false, apiKey: '', model: null }) },
  '@/lib/mail': { loadMailResearchMessages: async () => [], searchMailUids: async () => [] },
});

const plan = (overrides = {}) => ({
  scope: 'both',
  mode: 'collection',
  from: null,
  to: null,
  participant: null,
  subject: null,
  text: null,
  keywords: [],
  since: null,
  before: null,
  title: 'Synthetic research',
  ...overrides,
});

test('sent-to recipient research maps recipient to IMAP To', () => {
  const criteria = research.buildResearchCriteria(plan({ scope: 'sent', to: 'client@example.com' }), 'INBOX.Sent');
  assert.equal(criteria.to, 'client@example.com');
  assert.equal(criteria.from, undefined);
});

test('received-from research maps sender to IMAP From', () => {
  const criteria = research.buildResearchCriteria(plan({ scope: 'inbox', from: 'sender@example.com' }), 'INBOX');
  assert.equal(criteria.from, 'sender@example.com');
  assert.equal(criteria.to, undefined);
});

test('participant research maps From in Inbox and To in Sent', () => {
  const input = plan({ participant: 'Bob Hesse' });
  assert.equal(research.buildResearchCriteria(input, 'INBOX').from, 'Bob Hesse');
  assert.equal(research.buildResearchCriteria(input, 'INBOX.Sent').to, 'Bob Hesse');
});

test('phrase and date filters become bounded IMAP criteria', () => {
  const criteria = research.buildResearchCriteria(
    plan({ text: 'R3EQ', since: '2026-09-01', before: '2026-10-01' }),
    'INBOX',
  );
  assert.equal(criteria.text, 'R3EQ');
  assert.equal(criteria.since.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(criteria.before.toISOString(), '2026-10-01T00:00:00.000Z');
});
