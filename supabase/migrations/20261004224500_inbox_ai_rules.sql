BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_mail_ai_rules (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','important','normal','low')),
  sender_domains text[] NOT NULL DEFAULT '{}',
  sender_addresses text[] NOT NULL DEFAULT '{}',
  recipient_terms text[] NOT NULL DEFAULT '{}',
  subject_terms text[] NOT NULL DEFAULT '{}',
  body_terms text[] NOT NULL DEFAULT '{}',
  subject_prefixes text[] NOT NULL DEFAULT '{}',
  require_reply boolean NOT NULL DEFAULT false,
  actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  system boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_mail_ai_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_mail_ai_rules FROM anon, authenticated;

INSERT INTO public.ai_mail_ai_rules
(id,title,description,category,priority,sender_domains,sender_addresses,recipient_terms,subject_terms,body_terms,subject_prefixes,require_reply,actions,active,system,sort_order)
VALUES
('security-vulnerability','Security vulnerability / exposure','Elevate vendor security findings, RLS exposure, credential or data-access risk.','Security','urgent',
 ARRAY['supabase.com','github.com','aws.com'], ARRAY[]::text[], ARRAY[]::text[],
 ARRAY['security vulnerab','action required','critical issue','expose your data','unauthorized access'],
 ARRAY['row-level security','rls_disabled','unauthorized access','data is compromised','security vulnerabilities'],
 ARRAY[]::text[], false,
 '{"autoSummary":true,"suggestReply":false,"extractActions":true,"extractDeadline":true,"escalate":true}'::jsonb,true,true,10),

('infrastructure-pause-outage','Infrastructure pause / outage risk','Detect hosted projects, databases, or services that may pause, stop, or become unavailable.','Infrastructure','urgent',
 ARRAY['supabase.com','aws.com','vercel.com'], ARRAY[]::text[], ARRAY[]::text[],
 ARRAY['going to be paused','has been paused','service interruption','outage','suspended'],
 ARRAY['scheduled to be paused','will be paused automatically','unpause','service interruption'],
 ARRAY[]::text[], false,
 '{"autoSummary":true,"suggestReply":false,"extractActions":true,"extractDeadline":true,"escalate":true}'::jsonb,true,true,20),

('onboarding-kyc','Account onboarding / KYC follow-up','Identify business-account activation, KYC/KYB, document, representative, or pending onboarding requests.','Onboarding & Compliance','important',
 ARRAY['coinbase.com'], ARRAY['clientonboarding@coinbase.com'], ARRAY[]::text[],
 ARRAY['pending items','account activation','application is under review','action required'],
 ARRAY['outstanding items','activate your account','secure portal','requested documentation','company representative'],
 ARRAY[]::text[], false,
 '{"autoSummary":true,"suggestReply":true,"extractActions":true,"extractDeadline":true,"escalate":true}'::jsonb,true,true,30),

('billing-receipt','Billing receipt / invoice','Classify receipts, invoices and statements without over-escalating routine confirmations.','Billing','normal',
 ARRAY['figma.com','aws.com','stripe.com'], ARRAY[]::text[], ARRAY[]::text[],
 ARRAY['receipt','billing statement','invoice','payment'],
 ARRAY['receipt','invoice','billing statement','payment received'],
 ARRAY[]::text[], false,
 '{"autoSummary":false,"suggestReply":false,"extractActions":false,"extractDeadline":false,"escalate":false}'::jsonb,true,true,40),

('subscription-renewal','Subscription renewal / upcoming charge','Surface upcoming renewals and service charges early enough for review.','Billing','important',
 ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[],
 ARRAY['renewal reminder','subscription renewal','upcoming charge','renews on'],
 ARRAY['renewal','subscription','will be charged','renews'],
 ARRAY[]::text[], false,
 '{"autoSummary":false,"suggestReply":false,"extractActions":true,"extractDeadline":true,"escalate":false}'::jsonb,true,true,50),

('platform-breaking-change','Platform breaking change / migration','Detect vendor behavior changes that require code, schema, migration, or permission updates.','Platform Change','important',
 ARRAY['supabase.com','aws.com','vercel.com','github.com'], ARRAY[]::text[], ARRAY[]::text[],
 ARRAY['need explicit grants','breaking change','action may be required','starting november','starting october'],
 ARRAY['what changes','what to do','migration','explicit grant','will stop automatically','will no longer'],
 ARRAY[]::text[], false,
 '{"autoSummary":true,"suggestReply":false,"extractActions":true,"extractDeadline":true,"escalate":true}'::jsonb,true,true,60),

('cloud-cost-change','Cloud cost / billing automation impact','Flag cloud billing changes that can break cost allocation, budgets, or reporting automation.','Cloud Finance','important',
 ARRAY['aws.com'], ARRAY['health@aws.com'], ARRAY[]::text[],
 ARRAY['charges','cost explorer','cost and usage report','billing'],
 ARRAY['cost allocation tags','cost reporting automation','budgets filters','chargeback jobs','resourceid'],
 ARRAY[]::text[], false,
 '{"autoSummary":true,"suggestReply":false,"extractActions":true,"extractDeadline":true,"escalate":true}'::jsonb,true,true,70),

('monitor-human-reply','Human reply to r3alm Monitor','Prioritize stakeholder replies to automated market, readiness, distribution, or monitoring reports.','Monitor Feedback','important',
 ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[],
 ARRAY['r3alm monitor'], ARRAY[]::text[], ARRAY['re: r3alm monitor'], true,
 '{"autoSummary":true,"suggestReply":true,"extractActions":true,"extractDeadline":false,"escalate":true,"sentiment":true}'::jsonb,true,true,80),

('monitor-internal-report','Internal r3alm Monitor report','Recognize generated monitor reports so they remain searchable without competing with human replies.','r3alm Monitor','normal',
 ARRAY['r3alm.com'], ARRAY['admin@r3alm.com'], ARRAY[]::text[],
 ARRAY['r3alm monitor'], ARRAY[]::text[], ARRAY['r3alm monitor'], false,
 '{"autoSummary":false,"suggestReply":false,"extractActions":false,"extractDeadline":false,"escalate":false}'::jsonb,true,true,90),

('developer-delivery','GitHub / Vercel delivery notification','Classify PR, deployment, preview and bot notifications as engineering workflow.','Engineering','normal',
 ARRAY['github.com','vercel.com'], ARRAY['notifications@github.com'], ARRAY[]::text[],
 ARRAY['pull request','pr #','deployment','vercel[bot]'], ARRAY['preview','building','deployment','pull/'],
 ARRAY[]::text[], false,
 '{"autoSummary":false,"suggestReply":false,"extractActions":true,"extractDeadline":false,"escalate":false}'::jsonb,true,true,100),

('trusted-spam-prefix','Trusted system mail marked SPAM','Recover trusted platform mail that received a subject-line spam prefix; keep it reviewable instead of discarding it.','System Review','important',
 ARRAY['supabase.com','github.com','vercel.com','openai.com'], ARRAY[]::text[], ARRAY[]::text[],
 ARRAY[]::text[], ARRAY[]::text[], ARRAY['***spam***'], false,
 '{"autoSummary":true,"suggestReply":false,"extractActions":true,"extractDeadline":true,"escalate":false}'::jsonb,true,true,110),

('product-newsletter','Product newsletter / feature update','Compress product announcements, feature newsletters, events and release roundups.','Product Updates','low',
 ARRAY['resend.com','figma.com','openai.com','grok.com'], ARRAY[]::text[], ARRAY[]::text[],
 ARRAY['new integrations','feature updates','what''s new','image styles','talk it through','early access'],
 ARRAY['changelog','product newsletter','early access','new integration','feature'],
 ARRAY[]::text[], false,
 '{"autoSummary":true,"suggestReply":false,"extractActions":false,"extractDeadline":false,"escalate":false,"compress":true}'::jsonb,true,true,120),

('investment-opportunity','Investment / auction opportunity','Separate auction and private-offering opportunities from operational mail.','Investment Opportunities','normal',
 ARRAY['ha.com'], ARRAY['bid@ha.com'], ARRAY[]::text[],
 ARRAY['private offerings','auction','bid'], ARRAY['offering','auction','bid'],
 ARRAY[]::text[], false,
 '{"autoSummary":true,"suggestReply":false,"extractActions":false,"extractDeadline":true,"escalate":false}'::jsonb,true,true,130),

('identity-verification','Identity / verification code','Recognize verification codes and confirmation messages; keep them high visibility but short-lived.','Identity','important',
 ARRAY['coinbase.com','supabase.io','supabase.com'], ARRAY[]::text[], ARRAY[]::text[],
 ARRAY['verification code','confirm your email','oauth application approval','mfa reset'],
 ARRAY['verification code','confirm your email','oauth','mfa'],
 ARRAY[]::text[], false,
 '{"autoSummary":false,"suggestReply":false,"extractActions":true,"extractDeadline":true,"escalate":false,"sensitive":true}'::jsonb,true,true,140)
ON CONFLICT (id) DO UPDATE SET
 title=EXCLUDED.title, description=EXCLUDED.description, category=EXCLUDED.category,
 priority=EXCLUDED.priority, sender_domains=EXCLUDED.sender_domains, sender_addresses=EXCLUDED.sender_addresses,
 recipient_terms=EXCLUDED.recipient_terms, subject_terms=EXCLUDED.subject_terms, body_terms=EXCLUDED.body_terms,
 subject_prefixes=EXCLUDED.subject_prefixes, require_reply=EXCLUDED.require_reply, actions=EXCLUDED.actions,
 sort_order=EXCLUDED.sort_order, updated_at=now();

COMMIT;
