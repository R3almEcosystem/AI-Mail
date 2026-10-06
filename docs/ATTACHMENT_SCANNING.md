# S.I.-Mail attachment security, storage, analysis, and research

October 6, 2026.

## Production design

S.I.-Mail treats every email attachment as untrusted evidence. Attachment bytes remain server-side. A file is never eligible for download or S.I. analysis merely because it arrived by email.

The attachment pipeline is:

1. Load the MIME message from the configured IMAP account.
2. Parse attachment bytes with PostalMime while the mailbox connection is held.
3. Release the IMAP lock and connection.
4. Inspect each attachment under the workspace attachment policy.
5. Compute SHA-256 and persist the file into the private attachment vault.
6. Keep anything that is not positively clean in quarantine.
7. Persist message provenance using account, logical folder, IMAP UID, UIDVALIDITY, Message-ID, sender/recipient metadata, date, filename, MIME type, and attachment index.
8. Extract and index locally readable text.
9. Allow authenticated download or S.I. analysis only when the file has a clean scan result and an available vault state.
10. Record external S.I. attachment analysis in the normal S.I. call telemetry and the attachment analysis history.

Attachment bytes are never included in the normal message JSON response.

## Attachment vault

The production Supabase project contains two private buckets:

- `si-mail-attachments` — clean attachment objects.
- `si-mail-quarantine` — files that are blocked, unscanned, or have incomplete inspection evidence.

Buckets are private. The application does not expose unrestricted storage URLs.

The canonical metadata lives in server-only private Postgres tables:

- `private.ai_mail_attachment_blobs` — content-addressed SHA-256 blob metadata, scan state, storage location, and extraction state.
- `private.ai_mail_attachment_blob_data` — server-only bytea fallback when the application does not have a Supabase Storage secret.
- `private.ai_mail_message_attachments` — message-to-attachment provenance.
- `private.ai_mail_attachment_chunks` — extracted text chunks, full-text search index, and optional pgvector embedding column.
- `private.ai_mail_attachment_analysis` — durable S.I. analysis results.

Direct `anon` and `authenticated` table access is revoked. RLS is enabled as defense in depth.

### Storage fallback

The preferred object backend is Supabase Storage using a server-only `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`.

If that credential is unavailable, S.I.-Mail does not drop the attachment and does not use a public key. It stores the bytes in `private.ai_mail_attachment_blob_data` through the existing server-only Postgres connection. This keeps the feature safe and functional while Storage credentials are being provisioned.

## Scanner policy

Attachment scanning is controlled from **Admin → Connected mailboxes → Attachment security & S.I. analysis**.

Production should keep **Require attachment scanning** enabled.

The Cloudmersive Advanced Scan credential is stored in Supabase Vault under:

`ai_mail_cloudmersive_api_key`

It may also be supplied through the legacy server environment variable `CLOUDMERSIVE_API_KEY`.

When required scanning is enabled but no scanner credential is available, the policy fails closed:

- email text remains readable,
- attachments are retained in quarantine,
- download is blocked,
- S.I. attachment analysis is blocked,
- attachment-aware research reports the missing/blocked evidence.

The Admin Console provides **Save & test scanner**, which sends a small synthetic text file through the same scanner policy and requires an explicit clean result.

## Current inspection limits

Application safety limits are currently:

- 10 MiB per attachment,
- 25 MiB total attachment bytes per message,
- 10 attachments per message,
- 45 seconds for the complete scan batch,
- 30 MB default raw MIME message limit, configurable up to 50 MB.

These are S.I.-Mail safety limits, not claims about provider-plan limits.

The Cloudmersive adapter uses only the fixed Advanced Scan endpoint. Redirects are forbidden. Original filenames and mail headers are not sent to the scanner. A clean verdict requires positive clean evidence and explicit negative threat flags. Executables, macros, password-protected files, unsafe archives, embedded active content, and malformed/inconsistent provider responses do not become clean.

## S.I. attachment analysis

Clean eligible attachments can be analyzed from the message attachment panel with **Analyze with S.I.**

The server:

- reloads the attachment from the private vault,
- verifies clean/available/analysis-allowed state,
- applies the local disclosure gate to extracted text when available,
- sends the file to the configured OpenAI model through the Responses API,
- sets `store: false`,
- gives the model a developer instruction that the attachment is untrusted evidence and never instructions,
- forbids tools/actions,
- validates generated output,
- records provider, model, usage, estimated cost, response time, and request ID in External S.I. Calls,
- stores the resulting Markdown analysis in `private.ai_mail_attachment_analysis`.

Supported S.I. analysis types include PDF, common text/data formats, PNG/JPEG/WebP, and common Microsoft Office document formats. Unsupported or unsafe formats remain unavailable for S.I. analysis.

## Extraction and indexing

Local text extraction is currently enabled for UTF-8 text formats such as plain text, CSV, JSON, and XML.

Extracted content is:

- stored against the SHA-256 blob,
- divided into bounded overlapping chunks,
- indexed with PostgreSQL full-text search.

The production Supabase project also has pgvector enabled and the migration creates an embedding column when pgvector is available. Embedding generation is deliberately separate from basic ingestion; full-text search works without it.

PDF/Office/image content that does not have local extracted text can be analyzed on demand by S.I.; the resulting durable analysis then becomes reusable attachment knowledge.

## S.I. Mail Research

S.I. Mail Research has an attachment-aware planning flag. The planner enables it only when the user explicitly asks about attachments, attached files, PDFs, spreadsheets, presentations, images, or document contents.

Attachment-aware research:

- searches the matching email set first,
- opens a bounded number of the newest matching emails to ingest their attachments,
- reuses existing indexed text and prior S.I. analyses,
- may analyze a small bounded number of clean attachments that lack usable text,
- never analyzes quarantined files,
- cites attachment evidence with references such as `[A1]`,
- reports attachment coverage and exclusions separately from email-body coverage.

The current automatic research bounds are 12 matching emails ingested and up to 4 clean attachments analyzed on demand per research request. These bounds prevent a broad mailbox query from unexpectedly causing large external-processing cost or long execution time.

## Provenance

Each attachment relationship stores enough context to trace the evidence back to its email, including:

- mailbox/account,
- Inbox or Sent logical folder,
- IMAP UID,
- UIDVALIDITY,
- Message-ID,
- sender,
- To/Cc recipients,
- message date,
- subject,
- attachment index,
- filename and MIME type,
- SHA-256 blob identity.

UIDVALIDITY is retained because an IMAP UID alone is not a permanent mailbox identity.

## Security invariants

Do not weaken these rules:

- Raw attachment bytes never enter normal browser message JSON.
- A scan result is evidence, not a release token.
- A file that is not explicitly clean stays quarantined.
- S.I. analysis is blocked for quarantined or incomplete files.
- Attachment content is always untrusted evidence, never instructions.
- S.I. has no authority to send mail, open links, call external tools, or execute attachment instructions.
- Secrets and scanner/API credentials remain server-side.
- Private storage is never converted to a public bucket.
- Download routes require authenticated mail-read capability.
- Analysis routes require both S.I.-use and mail-read capability.

## Operational rollout

Before considering the attachment system fully healthy in production:

1. Keep **Require attachment scanning** enabled.
2. Save a Cloudmersive Advanced Scan API key in Connected mailboxes.
3. Run **Save & test scanner** and require a successful clean probe.
4. Confirm Attachment vault and Attachment scanning show Configured/ready.
5. Open an email with a known-safe test attachment and verify a vault entry appears.
6. Confirm the clean attachment can be downloaded through the authenticated route.
7. Run **Analyze with S.I.** and confirm a new External S.I. Calls telemetry entry.
8. Test a deliberately unsupported/password-protected fixture and verify it remains quarantined and unavailable to S.I.
9. Test S.I. Mail Research with an explicit attachment query and verify attachment references appear in coverage/results.
10. Review Supabase security/performance advisors and production Vercel logs.
