create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.ai_mail_accounts (
  id uuid primary key,
  label text not null check (char_length(label) between 1 and 120),
  email text not null check (char_length(email) between 3 and 320),
  active boolean not null default true,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),

  imap_host text not null check (char_length(imap_host) between 1 and 255),
  imap_port integer not null default 993 check (imap_port between 1 and 65535),
  imap_secure boolean not null default true,
  imap_user text not null check (char_length(imap_user) between 1 and 320),
  imap_secret_name text not null unique check (char_length(imap_secret_name) between 1 and 255),
  sent_folder text not null default 'INBOX.Sent' check (char_length(sent_folder) between 1 and 255),
  archive_folder text not null default 'Archive' check (char_length(archive_folder) between 1 and 255),

  smtp_enabled boolean not null default true,
  smtp_host text,
  smtp_port integer check (smtp_port is null or smtp_port between 1 and 65535),
  smtp_secure boolean not null default true,
  smtp_user text,
  smtp_from text,
  smtp_secret_name text unique,

  created_by text references public.ai_mail_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (email !~ '[[:cntrl:]]'),
  check (imap_host !~ '[[:space:]/?#@]'),
  check (imap_user !~ '[[:cntrl:]]'),
  check (sent_folder !~ '[[:cntrl:]]'),
  check (archive_folder !~ '[[:cntrl:]]'),
  check (
    smtp_enabled = false
    or (
      smtp_host is not null and char_length(smtp_host) between 1 and 255
      and smtp_port is not null
      and smtp_user is not null and char_length(smtp_user) between 1 and 320
      and smtp_from is not null and char_length(smtp_from) between 1 and 320
      and smtp_secret_name is not null
    )
  )
);

alter table private.ai_mail_accounts enable row level security;

revoke all on table private.ai_mail_accounts from public;
revoke all on table private.ai_mail_accounts from anon;
revoke all on table private.ai_mail_accounts from authenticated;

create index if not exists ai_mail_accounts_active_sort_idx
  on private.ai_mail_accounts (active desc, sort_order asc, created_at asc);
