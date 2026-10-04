const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./module-loader.cjs');

const { evaluateAiRules } = loadModule('src/lib/ai-rules.ts', {
  postgres: () => { throw new Error('database should not be used by evaluator tests'); },
  '@/lib/auth': { databaseConnectionString: () => null },
});

const rule = (overrides) => ({
  id: 'rule',
  title: 'Rule',
  description: '',
  category: 'General',
  priority: 'normal',
  senderDomains: [],
  senderAddresses: [],
  recipientTerms: [],
  subjectTerms: [],
  bodyTerms: [],
  subjectPrefixes: [],
  requireReply: false,
  actions: {},
  active: true,
  system: true,
  sortOrder: 100,
  ...overrides,
});

test('security notices match trusted subdomains and elevate urgency', () => {
  const rules = [rule({
    id: 'security',
    category: 'Security',
    priority: 'urgent',
    senderDomains: ['supabase.com'],
    subjectTerms: ['security vulnerab'],
    actions: { autoSummary: true, escalate: true },
  })];
  const result = evaluateAiRules(rules, {
    senderEmail: 'noreply@mail.supabase.com',
    subject: 'Action required: security vulnerabilities detected',
  });
  assert.equal(result.category, 'Security');
  assert.equal(result.priority, 'urgent');
  assert.equal(result.autoSummary, true);
  assert.equal(result.escalate, true);
});

test('Coinbase onboarding follow-up produces action-oriented compliance classification', () => {
  const rules = [rule({
    id: 'kyc',
    category: 'Onboarding & Compliance',
    priority: 'important',
    senderDomains: ['coinbase.com'],
    subjectTerms: ['pending items'],
    bodyTerms: ['outstanding items'],
    actions: { suggestReply: true, extractActions: true, extractDeadline: true },
  })];
  const result = evaluateAiRules(rules, {
    senderEmail: 'clientonboarding@coinbase.com',
    subject: 'Follow-Up: Pending Items to Activate Your Coinbase Business Account',
    body: 'Outstanding Items: confirm the company representative.',
  });
  assert.equal(result.category, 'Onboarding & Compliance');
  assert.equal(result.suggestReply, true);
  assert.equal(result.extractActions, true);
});

test('strong stakeholder concern outranks a general monitor reply', () => {
  const rules = [
    rule({
      id: 'concern',
      category: 'Stakeholder Concern',
      priority: 'urgent',
      bodyTerms: ['biggest position'],
      subjectPrefixes: ['re:'],
      requireReply: true,
      sortOrder: 75,
      actions: { sentiment: true, escalate: true },
    }),
    rule({
      id: 'monitor',
      category: 'Monitor Feedback',
      priority: 'important',
      subjectTerms: ['r3alm monitor'],
      subjectPrefixes: ['re: r3alm monitor'],
      requireReply: true,
      sortOrder: 80,
    }),
  ];
  const result = evaluateAiRules(rules, {
    senderEmail: 'stakeholder@example.com',
    subject: 'Re: r3alm Monitor : VYST Market Alert',
    body: "I don't need any more bad news on my biggest position.",
    isReply: true,
  });
  assert.equal(result.category, 'Stakeholder Concern');
  assert.equal(result.priority, 'urgent');
  assert.equal(result.sentiment, true);
  assert.deepEqual(result.matches.map(item => item.id), ['concern', 'monitor']);
});

test('direct stakeholder instruction is actionable', () => {
  const rules = [rule({
    id: 'directive',
    category: 'Executive Requests',
    priority: 'important',
    bodyTerms: ['you should'],
    subjectPrefixes: ['re:'],
    requireReply: true,
    actions: { extractActions: true, suggestReply: true },
  })];
  const result = evaluateAiRules(rules, {
    senderEmail: 'director@example.com',
    subject: 'Re: r3alm Monitor : Distribution Verification',
    body: 'You should add BOD member Dr Stone.',
    isReply: true,
  });
  assert.equal(result.category, 'Executive Requests');
  assert.equal(result.extractActions, true);
  assert.equal(result.suggestReply, true);
});

test('product newsletters compress without escalation', () => {
  const rules = [rule({
    id: 'newsletter',
    category: 'Product Updates',
    priority: 'low',
    senderDomains: ['resend.com'],
    subjectTerms: ['new integrations'],
    actions: { autoSummary: true, compress: true },
  })];
  const result = evaluateAiRules(rules, {
    senderEmail: 'zeno@updates.resend.com',
    subject: 'Early access, new integrations, and more',
  });
  assert.equal(result.category, 'Product Updates');
  assert.equal(result.priority, 'low');
  assert.equal(result.autoSummary, true);
  assert.equal(result.compress, true);
});
