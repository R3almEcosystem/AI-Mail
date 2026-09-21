-- Apply before deploying phase 1. No existing accounts or mailbox records are deleted.
BEGIN;
ALTER TABLE public.ai_mail_users ADD COLUMN auth_version bigint NOT NULL DEFAULT 1;
CREATE TABLE public.ai_mail_sessions (
  id_hash text PRIMARY KEY CHECK (id_hash ~ '^[a-f0-9]{64}$'),
  user_id text NOT NULL REFERENCES public.ai_mail_users(id) ON DELETE CASCADE,
  auth_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX ai_mail_sessions_user_idx ON public.ai_mail_sessions(user_id);
CREATE INDEX ai_mail_sessions_expiry_idx ON public.ai_mail_sessions(expires_at);
CREATE TABLE public.ai_mail_login_limits (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  attempts integer NOT NULL CHECK (attempts >= 1),
  window_started_at timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE public.ai_mail_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_mail_login_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_mail_sessions, public.ai_mail_login_limits FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.ai_mail_bump_auth_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.auth_version := OLD.auth_version + 1;
  ELSE
    NEW.auth_version := OLD.auth_version;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ai_mail_bump_auth_version() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ai_mail_invalidate_sessions BEFORE UPDATE ON public.ai_mail_users
FOR EACH ROW EXECUTE FUNCTION public.ai_mail_bump_auth_version();
COMMENT ON TABLE public.ai_mail_sessions IS 'Server-only revocable browser sessions; cookie identifiers are stored only as SHA-256 hashes.';
COMMENT ON TABLE public.ai_mail_login_limits IS 'Server-only HMAC identity keys for distributed sign-in rate limits; periodically prune windows older than 24 hours.';
COMMIT;
