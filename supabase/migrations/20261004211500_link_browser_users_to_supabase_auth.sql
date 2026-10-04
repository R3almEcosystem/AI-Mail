-- Browser credentials are verified by Supabase Auth.
-- This table stores AI-Mail authorization only; password_hash is intentionally null.
BEGIN;

INSERT INTO public.ai_mail_users (id, name, email, title, role, status, password_hash)
SELECT
  id::text,
  'Bernie O''Neill',
  lower(email),
  'Director / Engineer',
  'super_admin',
  'active',
  NULL
FROM auth.users
WHERE lower(email) = 'bernie@r3alm.com'
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  password_hash = NULL,
  updated_at = now();

INSERT INTO public.ai_mail_users (id, name, email, title, role, status, password_hash)
SELECT
  id::text,
  'r3alm Administrator',
  lower(email),
  'AI Mail Administrator',
  'admin',
  'active',
  NULL
FROM auth.users
WHERE lower(email) = 'admin@r3alm.com'
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  password_hash = NULL,
  updated_at = now();

COMMIT;
