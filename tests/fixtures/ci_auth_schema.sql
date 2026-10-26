-- Only for the ephemeral GitHub Actions PostgreSQL service.
-- Mimics the minimum Supabase Auth table signature needed for migration
-- parsing; it contains NO real users, credentials, secrets, or provider state.
-- Never apply this fixture to Supabase or a production database.
DO $$
BEGIN
  IF current_database() <> 'aimail_phase1_test' THEN
    RAISE EXCEPTION 'CI-only Auth schema fixture requires aimail_phase1_test';
  END IF;
END $$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE
);
