create schema if not exists private;

create table if not exists private.ai_mail_ai_calls (
  id uuid primary key,
  actor_id text,
  actor_name text,
  provider text not null check (char_length(provider) between 1 and 80),
  operation text not null check (char_length(operation) between 1 and 120),
  endpoint text not null check (char_length(endpoint) between 1 and 160),
  model text,
  account_id text,
  status text not null check (status in ('succeeded', 'failed')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  cached_input_tokens integer check (cached_input_tokens is null or cached_input_tokens >= 0),
  cache_write_tokens integer check (cache_write_tokens is null or cache_write_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  estimated_cost_usd numeric(16, 8) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  response_time_ms integer not null check (response_time_ms >= 0),
  provider_request_id text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table private.ai_mail_ai_calls is
  'Server-only external AI provider telemetry. Stores operational metadata only; never prompts, email bodies, or generated response content.';

alter table private.ai_mail_ai_calls enable row level security;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.ai_mail_ai_calls from public, anon, authenticated;

create index if not exists ai_mail_ai_calls_created_idx
  on private.ai_mail_ai_calls (created_at desc, id desc);

create index if not exists ai_mail_ai_calls_provider_model_idx
  on private.ai_mail_ai_calls (provider, model, created_at desc);
