BEGIN;

ALTER TABLE public.ai_mail_ai_rules
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'both';

ALTER TABLE public.ai_mail_ai_rules
  DROP CONSTRAINT IF EXISTS ai_mail_ai_rules_direction_check;

ALTER TABLE public.ai_mail_ai_rules
  ADD CONSTRAINT ai_mail_ai_rules_direction_check
  CHECK (direction IN ('inbound','outbound','both'));

UPDATE public.ai_mail_ai_rules
SET direction='inbound', updated_at=now()
WHERE id IN (
  'security-vulnerability','infrastructure-pause-outage','onboarding-kyc',
  'billing-receipt','subscription-renewal','cloud-cost-change',
  'platform-breaking-change','stakeholder-concern','stakeholder-directive',
  'monitor-human-reply','trusted-spam-prefix','product-newsletter',
  'investment-opportunity','identity-verification'
);

UPDATE public.ai_mail_ai_rules
SET direction='both', updated_at=now()
WHERE id IN ('monitor-internal-report','developer-delivery');

INSERT INTO public.ai_mail_ai_rules
(id,title,description,category,priority,sender_domains,sender_addresses,recipient_terms,subject_terms,body_terms,subject_prefixes,require_reply,actions,active,system,sort_order,direction)
VALUES
('sent-monitor-distribution','Sent r3alm Monitor distribution','Recognize outbound r3alm Monitor reports and keep them grouped as sent monitoring activity.','Sent Monitor','normal',
 ARRAY['r3alm.com'],ARRAY['admin@r3alm.com'],ARRAY[]::text[],
 ARRAY['r3alm monitor'],ARRAY[]::text[],ARRAY['r3alm monitor'],false,
 '{"autoSummary":false,"suggestReply":false,"extractActions":false,"extractDeadline":false,"escalate":false}'::jsonb,true,true,160,'outbound'),

('sent-compliance-response','Sent compliance / onboarding response','Classify outbound responses to KYC/KYB, business onboarding, and account activation requests.','Compliance Response','important',
 ARRAY['r3alm.com'],ARRAY['admin@r3alm.com'],ARRAY['coinbase.com'],
 ARRAY['pending items','business account activation','coinbase business'],ARRAY[]::text[],ARRAY['re:'],true,
 '{"autoSummary":true,"suggestReply":false,"extractActions":true,"extractDeadline":true,"escalate":false}'::jsonb,true,true,170,'outbound'),

('sent-executive-correspondence','Sent executive correspondence','Recognize direct outbound executive messages that are not automated monitor traffic.','Sent Correspondence','normal',
 ARRAY['r3alm.com'],ARRAY['admin@r3alm.com','bernie@r3alm.com'],ARRAY[]::text[],
 ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],false,
 '{"autoSummary":false,"suggestReply":false,"extractActions":false,"extractDeadline":false,"escalate":false}'::jsonb,true,true,190,'outbound')
ON CONFLICT (id) DO UPDATE SET
 title=EXCLUDED.title,description=EXCLUDED.description,category=EXCLUDED.category,
 priority=EXCLUDED.priority,sender_domains=EXCLUDED.sender_domains,sender_addresses=EXCLUDED.sender_addresses,
 recipient_terms=EXCLUDED.recipient_terms,subject_terms=EXCLUDED.subject_terms,body_terms=EXCLUDED.body_terms,
 subject_prefixes=EXCLUDED.subject_prefixes,require_reply=EXCLUDED.require_reply,actions=EXCLUDED.actions,
 active=EXCLUDED.active,system=EXCLUDED.system,sort_order=EXCLUDED.sort_order,direction=EXCLUDED.direction,updated_at=now();

COMMIT;
