BEGIN;
-- Identity only: no account, role, settings, mailbox or connection records change.
CREATE TABLE public.ai_mail_sovsi_identity_links (
 subject uuid PRIMARY KEY,
 user_id text NOT NULL UNIQUE REFERENCES public.ai_mail_users(id) ON DELETE RESTRICT,
 enabled boolean NOT NULL DEFAULT true,
 verified_by text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_mail_sovsi_identity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_mail_sovsi_identity_links FROM PUBLIC,anon,authenticated;
ALTER TABLE public.ai_mail_sessions ADD COLUMN sovsi_subject uuid,
 ADD COLUMN sovsi_session_id uuid,ADD COLUMN sovsi_tokens text;
ALTER TABLE public.ai_mail_sessions ADD CONSTRAINT sovsi_session_complete CHECK
 ((sovsi_subject IS NULL AND sovsi_session_id IS NULL AND sovsi_tokens IS NULL)
 OR (sovsi_subject IS NOT NULL AND sovsi_session_id IS NOT NULL AND sovsi_tokens IS NOT NULL));
CREATE INDEX ai_mail_sessions_sovsi_subject_idx ON public.ai_mail_sessions(sovsi_subject);
COMMENT ON COLUMN public.ai_mail_sessions.sovsi_tokens IS 'AES-256-GCM encrypted central OAuth token pair; bound to session id hash. Server-only.';
-- Exact reviewed existing account pairs. These inserts do not confer any new role.
INSERT INTO public.ai_mail_sovsi_identity_links(subject,user_id,verified_by)
SELECT pair.subject::uuid,u.id,'reviewed-existing-account-2026-10-25'
FROM (VALUES
 ('e24b14f9-fa55-42af-adc7-767b812068b2','970d47f4-d9de-4846-8be5-3ebff56a83e0','admin@sovsi.xyz','super_admin'),
 ('7f3551ce-6ce1-4b27-ba34-62f02bbf5330','60db35d0-9c48-4ee6-83c2-84f35c728299','admin@r3alm.com','admin'),
 ('b3396e19-bf1e-4c32-8dfb-ca551cf8c1c0','cf094a91-d030-409d-a715-13f2b6552469','bernie@r3alm.com','super_admin')
) AS pair(subject,local_id,email,role)
JOIN public.ai_mail_users u ON u.id=pair.local_id AND u.email=pair.email AND u.role=pair.role AND u.status='active'
JOIN auth.users au ON au.id::text=u.id AND lower(au.email)=pair.email;
-- Bernie remains blocked until his central email confirmation and MFA requirements are satisfied.
-- Never infer links from email/user_metadata. Existing local-only sessions fail closed in the new server.
COMMIT;
