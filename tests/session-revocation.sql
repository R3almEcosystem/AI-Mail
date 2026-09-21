-- Run only against the ephemeral CI database, never production.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'aimail_phase1_test' THEN RAISE EXCEPTION 'Synthetic test database required'; END IF;
END $$;
INSERT INTO public.ai_mail_users(id,name,email,role,status,password_hash)
VALUES('phase1-test','Synthetic Test','phase1@example.test','admin','active','synthetic-hash');
INSERT INTO public.ai_mail_sessions(id_hash,user_id,auth_version,expires_at)
VALUES(repeat('a',64),'phase1-test',1,NOW()+INTERVAL '1 hour');
DO $$ DECLARE version_before bigint; BEGIN
  UPDATE public.ai_mail_users SET last_login_at=NOW() WHERE id='phase1-test';
  IF (SELECT auth_version FROM public.ai_mail_users WHERE id='phase1-test') <> 1 THEN RAISE EXCEPTION 'Login timestamp must not revoke sessions'; END IF;
  UPDATE public.ai_mail_users SET status='suspended' WHERE id='phase1-test';
  UPDATE public.ai_mail_users SET status='active' WHERE id='phase1-test';
  IF EXISTS(SELECT 1 FROM public.ai_mail_sessions s JOIN public.ai_mail_users u ON u.id=s.user_id AND u.auth_version=s.auth_version WHERE u.id='phase1-test') THEN RAISE EXCEPTION 'Reactivation resurrected a revoked session'; END IF;
  SELECT auth_version INTO version_before FROM public.ai_mail_users WHERE id='phase1-test';
  UPDATE public.ai_mail_users SET password_hash='replacement-synthetic-hash' WHERE id='phase1-test';
  IF (SELECT auth_version FROM public.ai_mail_users WHERE id='phase1-test') <> version_before+1 THEN RAISE EXCEPTION 'Password change did not revoke'; END IF;
  UPDATE public.ai_mail_users SET role='viewer' WHERE id='phase1-test';
  IF (SELECT auth_version FROM public.ai_mail_users WHERE id='phase1-test') <> version_before+2 THEN RAISE EXCEPTION 'Role change did not revoke'; END IF;
  UPDATE public.ai_mail_users SET status='deleted' WHERE id='phase1-test';
  IF (SELECT auth_version FROM public.ai_mail_users WHERE id='phase1-test') <> version_before+3 THEN RAISE EXCEPTION 'Deletion did not revoke'; END IF;
  IF has_table_privilege('anon','public.ai_mail_sessions','SELECT') OR has_table_privilege('authenticated','public.ai_mail_sessions','SELECT') THEN RAISE EXCEPTION 'Session table publicly readable'; END IF;
END $$;
ROLLBACK;
