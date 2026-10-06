-- S.I.-Mail attachment vault, quarantine, provenance, analysis, and retrieval index.
-- Applied live to Supabase project cvrihauikkflnvunmvma on 2026-10-06 before this file was committed.

do $attachment_buckets$
begin
  if to_regclass('storage.buckets') is not null then
    execute $bucket_sql$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values
        ('si-mail-attachments', 'si-mail-attachments', false, 26214400, array[
          'application/pdf','text/plain','text/csv','application/json','application/xml','text/xml',
          'image/png','image/jpeg','image/webp',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint',
          'application/octet-stream'
        ]::text[]),
        ('si-mail-quarantine', 'si-mail-quarantine', false, 26214400, null)
      on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types
    $bucket_sql$;
  end if;
end
$attachment_buckets$;

alter table public.ai_mail_settings
  add column if not exists attachment_scanning_required boolean not null default true;

create table if not exists private.ai_mail_attachment_blobs (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes bigint not null check (bytes > 0 and bytes <= 26214400),
  mime_type text not null default 'application/octet-stream',
  storage_backend text not null check (storage_backend in ('supabase_storage','postgres_bytea')),
  storage_bucket text not null,
  storage_path text not null,
  vault_state text not null check (vault_state in ('available','quarantine')),
  scan_status text not null check (scan_status in ('clean','blocked','error','not_scanned')),
  scan_provider text,
  scan_reason text,
  scanned_at timestamptz,
  extraction_status text not null default 'pending' check (extraction_status in ('pending','complete','unsupported','failed')),
  extracted_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_mail_attachment_blobs_storage_unique
  on private.ai_mail_attachment_blobs(storage_bucket, storage_path);

create table if not exists private.ai_mail_attachment_blob_data (
  blob_id uuid primary key references private.ai_mail_attachment_blobs(id) on delete cascade,
  content bytea not null check (octet_length(content) <= 26214400),
  created_at timestamptz not null default now()
);

create table if not exists private.ai_mail_message_attachments (
  id uuid primary key default gen_random_uuid(),
  blob_id uuid not null references private.ai_mail_attachment_blobs(id) on delete restrict,
  account_id text not null,
  folder text not null check (folder in ('INBOX','INBOX.Sent')),
  uid bigint not null check (uid between 1 and 4294967295),
  uid_validity text,
  message_id text,
  message_subject text,
  sender_email text,
  to_emails text[] not null default '{}'::text[],
  cc_emails text[] not null default '{}'::text[],
  message_date timestamptz,
  attachment_index integer not null check (attachment_index >= 0 and attachment_index < 100),
  filename text not null,
  mime_type text not null,
  disposition text,
  content_id text,
  analysis_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_mail_message_attachment_identity_unique
  on private.ai_mail_message_attachments(account_id, folder, coalesce(uid_validity,''), uid, attachment_index);
create index if not exists ai_mail_message_attachment_message_idx
  on private.ai_mail_message_attachments(account_id, folder, uid);
create index if not exists ai_mail_message_attachment_blob_idx
  on private.ai_mail_message_attachments(blob_id);
create index if not exists ai_mail_message_attachment_sender_idx
  on private.ai_mail_message_attachments(lower(sender_email), message_date desc);
create index if not exists ai_mail_message_attachment_date_idx
  on private.ai_mail_message_attachments(message_date desc);

create table if not exists private.ai_mail_attachment_chunks (
  id bigserial primary key,
  blob_id uuid not null references private.ai_mail_attachment_blobs(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  page_label text,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  unique(blob_id, chunk_index)
);

create index if not exists ai_mail_attachment_chunks_tsv_idx
  on private.ai_mail_attachment_chunks using gin(content_tsv);
create index if not exists ai_mail_attachment_chunks_blob_idx
  on private.ai_mail_attachment_chunks(blob_id);

create table if not exists private.ai_mail_attachment_analysis (
  id uuid primary key default gen_random_uuid(),
  message_attachment_id uuid not null references private.ai_mail_message_attachments(id) on delete cascade,
  actor_id text,
  analysis_type text not null default 'general',
  provider text not null,
  model text,
  result_markdown text not null,
  usage jsonb not null default '{}'::jsonb,
  estimated_cost_usd numeric(18,8),
  response_time_ms integer not null check (response_time_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_mail_attachment_analysis_attachment_idx
  on private.ai_mail_attachment_analysis(message_attachment_id, created_at desc);

alter table private.ai_mail_attachment_blobs enable row level security;
alter table private.ai_mail_attachment_blob_data enable row level security;
alter table private.ai_mail_message_attachments enable row level security;
alter table private.ai_mail_attachment_chunks enable row level security;
alter table private.ai_mail_attachment_analysis enable row level security;

revoke all on table private.ai_mail_attachment_blobs from public, anon, authenticated;
revoke all on table private.ai_mail_attachment_blob_data from public, anon, authenticated;
revoke all on table private.ai_mail_message_attachments from public, anon, authenticated;
revoke all on table private.ai_mail_attachment_chunks from public, anon, authenticated;
revoke all on table private.ai_mail_attachment_analysis from public, anon, authenticated;
revoke all on sequence private.ai_mail_attachment_chunks_id_seq from public, anon, authenticated;

-- pgvector is available in Supabase but not in the repository's bare-Postgres test harness.
-- Enable the semantic-search column only when the extension exists on the target server.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'vector') then
    execute 'create extension if not exists vector with schema extensions';
    execute 'alter table private.ai_mail_attachment_chunks add column if not exists embedding extensions.vector(1536)';
  end if;
end $$;
