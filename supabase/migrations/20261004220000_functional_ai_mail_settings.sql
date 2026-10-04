BEGIN;

ALTER TABLE public.ai_mail_settings
  ADD COLUMN IF NOT EXISTS imap_host text NOT NULL DEFAULT 'mail.r3alm.com',
  ADD COLUMN IF NOT EXISTS imap_port integer NOT NULL DEFAULT 993,
  ADD COLUMN IF NOT EXISTS imap_secure boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS imap_user text NOT NULL DEFAULT 'admin@r3alm.com',
  ADD COLUMN IF NOT EXISTS smtp_host text NOT NULL DEFAULT 'mail.r3alm.com',
  ADD COLUMN IF NOT EXISTS smtp_port integer NOT NULL DEFAULT 465,
  ADD COLUMN IF NOT EXISTS smtp_secure boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS smtp_user text NOT NULL DEFAULT 'admin@r3alm.com',
  ADD COLUMN IF NOT EXISTS smtp_from text NOT NULL DEFAULT 'admin@r3alm.com',
  ADD COLUMN IF NOT EXISTS mail_archive_folder text NOT NULL DEFAULT 'Archive',
  ADD COLUMN IF NOT EXISTS outbound_allowed_domains text NOT NULL DEFAULT '';

ALTER TABLE public.ai_mail_settings
  DROP CONSTRAINT IF EXISTS ai_mail_settings_imap_host_check,
  DROP CONSTRAINT IF EXISTS ai_mail_settings_imap_port_check,
  DROP CONSTRAINT IF EXISTS ai_mail_settings_imap_user_check,
  DROP CONSTRAINT IF EXISTS ai_mail_settings_smtp_host_check,
  DROP CONSTRAINT IF EXISTS ai_mail_settings_smtp_port_check,
  DROP CONSTRAINT IF EXISTS ai_mail_settings_smtp_user_check,
  DROP CONSTRAINT IF EXISTS ai_mail_settings_smtp_from_check,
  DROP CONSTRAINT IF EXISTS ai_mail_settings_archive_folder_check,
  DROP CONSTRAINT IF EXISTS ai_mail_settings_outbound_domains_check;

ALTER TABLE public.ai_mail_settings
  ADD CONSTRAINT ai_mail_settings_imap_host_check CHECK (char_length(btrim(imap_host)) BETWEEN 1 AND 255),
  ADD CONSTRAINT ai_mail_settings_imap_port_check CHECK (imap_port BETWEEN 1 AND 65535),
  ADD CONSTRAINT ai_mail_settings_imap_user_check CHECK (char_length(btrim(imap_user)) BETWEEN 1 AND 320),
  ADD CONSTRAINT ai_mail_settings_smtp_host_check CHECK (char_length(btrim(smtp_host)) BETWEEN 1 AND 255),
  ADD CONSTRAINT ai_mail_settings_smtp_port_check CHECK (smtp_port BETWEEN 1 AND 65535),
  ADD CONSTRAINT ai_mail_settings_smtp_user_check CHECK (char_length(btrim(smtp_user)) BETWEEN 1 AND 320),
  ADD CONSTRAINT ai_mail_settings_smtp_from_check CHECK (char_length(btrim(smtp_from)) BETWEEN 1 AND 320),
  ADD CONSTRAINT ai_mail_settings_archive_folder_check CHECK (char_length(btrim(mail_archive_folder)) BETWEEN 1 AND 255),
  ADD CONSTRAINT ai_mail_settings_outbound_domains_check CHECK (char_length(outbound_allowed_domains) <= 4000);

COMMIT;
