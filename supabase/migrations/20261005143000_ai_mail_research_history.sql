create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.ai_mail_research_history (
  id uuid primary key,
  user_id text not null references public.ai_mail_users(id) on delete cascade,
  query text not null check (char_length(query) between 3 and 2000),
  requested_scope text not null check (requested_scope in ('inbox','sent','both')),
  result_scope text not null check (result_scope in ('inbox','sent','both')),
  title text not null,
  markdown text not null,
  mode text not null check (mode in ('collection','report')),
  matched integer not null default 0 check (matched >= 0),
  included integer not null default 0 check (included >= 0),
  excluded integer not null default 0 check (excluded >= 0),
  capped boolean not null default false,
  model text,
  created_at timestamptz not null default now()
);

alter table private.ai_mail_research_history enable row level security;

revoke all on table private.ai_mail_research_history from public;
revoke all on table private.ai_mail_research_history from anon;
revoke all on table private.ai_mail_research_history from authenticated;

create index if not exists ai_mail_research_history_user_created_idx
  on private.ai_mail_research_history (user_id, created_at desc, id desc);
