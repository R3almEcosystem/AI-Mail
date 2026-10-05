alter table private.ai_mail_research_history
  add column if not exists warnings jsonb not null default '[]'::jsonb;

update private.ai_mail_research_history
set warnings =
  (case
    when capped then jsonb_build_array(
      'This search found more matching messages than one research request can safely process. The newest matches are included; narrow the query or date range for older results.'
    )
    else '[]'::jsonb
  end)
  ||
  (case
    when excluded > 0 then jsonb_build_array(
      excluded::text || ' matching message(s) were not included in the generated output because of processing or security limits.'
    )
    else '[]'::jsonb
  end)
where warnings = '[]'::jsonb
  and (capped or excluded > 0);

alter table private.ai_mail_research_history
  drop constraint if exists ai_mail_research_history_warnings_array_check;

alter table private.ai_mail_research_history
  add constraint ai_mail_research_history_warnings_array_check
  check (jsonb_typeof(warnings) = 'array');
