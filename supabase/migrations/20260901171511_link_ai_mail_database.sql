create table public.ai_mail_users (
  id text primary key,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  email text not null check (email = lower(email) and position('@' in email) > 1),
  title text not null default '' check (char_length(title) <= 160),
  role text not null check (role in ('super_admin', 'admin', 'manager', 'member', 'viewer')),
  status text not null check (status in ('active', 'invited', 'suspended', 'deleted')),
  password_hash text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ai_mail_users_email_lower_idx
  on public.ai_mail_users (lower(email));
create index ai_mail_users_status_idx
  on public.ai_mail_users (status);
create index ai_mail_users_role_idx
  on public.ai_mail_users (role);

create table public.ai_mail_settings (
  id text primary key,
  organization_name text not null check (char_length(btrim(organization_name)) between 1 and 160),
  workspace_name text not null check (char_length(btrim(workspace_name)) between 1 and 200),
  default_sender_name text not null check (char_length(btrim(default_sender_name)) between 1 and 160),
  support_email text not null check (position('@' in support_email) > 1),
  ai_model text not null check (char_length(btrim(ai_model)) between 1 and 120),
  ai_tone text not null check (ai_tone in ('concise', 'balanced', 'detailed')),
  ai_auto_summarize boolean not null default true,
  ai_priority_detection boolean not null default true,
  require_mfa boolean not null default false,
  session_timeout_minutes integer not null check (session_timeout_minutes between 5 and 10080),
  allow_demo_login boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.ai_mail_alert_groups (
  id text primary key,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  color text not null default 'blue' check (color in ('blue', 'violet', 'amber', 'red', 'green')),
  member_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(member_ids) = 'array'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ai_mail_alert_groups_name_lower_idx
  on public.ai_mail_alert_groups (lower(name));
create index ai_mail_alert_groups_active_name_idx
  on public.ai_mail_alert_groups (active desc, name);

create table public.ai_mail_audit_events (
  id text primary key,
  actor_id text references public.ai_mail_users(id) on delete set null,
  actor_name text not null check (char_length(btrim(actor_name)) between 1 and 160),
  action text not null check (char_length(btrim(action)) between 1 and 240),
  target text not null check (char_length(btrim(target)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index ai_mail_audit_events_created_at_idx
  on public.ai_mail_audit_events (created_at desc);
create index ai_mail_audit_events_actor_id_idx
  on public.ai_mail_audit_events (actor_id);

alter table public.ai_mail_users enable row level security;
alter table public.ai_mail_settings enable row level security;
alter table public.ai_mail_alert_groups enable row level security;
alter table public.ai_mail_audit_events enable row level security;

revoke all on table public.ai_mail_users from anon, authenticated;
revoke all on table public.ai_mail_settings from anon, authenticated;
revoke all on table public.ai_mail_alert_groups from anon, authenticated;
revoke all on table public.ai_mail_audit_events from anon, authenticated;

comment on table public.ai_mail_users is 'AI-Mail application identities and role assignments; server access only.';
comment on table public.ai_mail_settings is 'AI-Mail organization and AI policy settings; server access only.';
comment on table public.ai_mail_alert_groups is 'AI-Mail escalation groups; server access only.';
comment on table public.ai_mail_audit_events is 'Append-only AI-Mail administrative audit history; server access only.';

insert into public.ai_mail_settings (
  id,
  organization_name,
  workspace_name,
  default_sender_name,
  support_email,
  ai_model,
  ai_tone,
  ai_auto_summarize,
  ai_priority_detection,
  require_mfa,
  session_timeout_minutes,
  allow_demo_login
) values (
  'default',
  'r3alm',
  'AI-Mail Executive Workspace',
  'Bernie O’Neill',
  'support@r3alm.com',
  'gpt-5.2',
  'concise',
  true,
  true,
  false,
  720,
  false
);

insert into public.ai_mail_alert_groups (id, name, description, color, member_ids, active)
values
  ('group-executive', 'Executive Response', 'Time-sensitive decisions, approvals, and executive follow-up.', 'violet', '[]'::jsonb, true),
  ('group-legal', 'Legal & Compliance', 'Corporate, regulatory, trademark, and governance matters.', 'red', '[]'::jsonb, true),
  ('group-engineering', 'Engineering', 'Security, integrations, infrastructure, and product incidents.', 'blue', '[]'::jsonb, true),
  ('group-operations', 'Operations', 'Mailbox workflows, document routing, and client coordination.', 'green', '[]'::jsonb, true);
