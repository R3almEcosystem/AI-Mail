# Attachment inspection and AI privacy — phase 2

September 25, 2026. Code addition only; production activation is separate.

## Operator-controlled attachment scanning
The identical `src/security/attachment-scan.ts` module in both applications defines the provider contract, content-hash binding and Cloudmersive Advanced adapter. It adds no package dependency.

`EMAIL_ATTACHMENT_SCANNING` is unset/`disabled` by default. In this mode no file is uploaded to a scanner and no clean verdict is fabricated. A valid `CLOUDMERSIVE_API_KEY` alone does not activate scanning. An operator must explicitly select `EMAIL_ATTACHMENT_SCANNING=required` and provide that server-only key. Unknown mode values fail closed. Never use a `NEXT_PUBLIC_` variable for the key. No environment setting or credential was changed by this increment.

Before enabling, approve external processing/data residency, establish the account's Advanced Scan entitlement and current limits, provide quota/rate-limit controls, and run provider contract tests in staging. This implementation does not claim a free-tier allowance or a successfully exercised live provider connection.

The adapter uses only `https://api.cloudmersive.com/virus/scan/file/advanced`, with redirects forbidden. It uploads a bounded file under the neutral name `attachment.bin`; neither the original filename nor mail headers are submitted. The bytes themselves may contain sensitive information: operator consent to external inspection is essential. The provider response is bounded to 64 KiB and strict JSON. Clean requires a boolean positive result, explicit negative threat flags, an identified format and an empty/null virus list. Missing, malformed or inconsistent evidence never means clean. Executable, macro, encrypted/password-protected, invalid, unsafe-archive and other configured threats are refused. Provider diagnostics and threat filenames are not echoed to clients.

Local safety limits: 1 MiB per attachment, 4 attachments and 4 MiB total per message; 25 seconds for the complete scan batch. These are application limits, not statements of provider-plan limits. Every successful per-file result includes SHA-256 and byte count of the snapshotted bytes. Caller mutation and provider mutation cannot silently change the assessed object. Results are informational evidence, not signed or persistent release authorizations.

## Gateway API
`GET /api/v1/security/attachments/scan` requires bearer authentication with `email.read`. It reports configuration and limits; `health=not_probed` explicitly avoids claiming a successful provider connection.

`POST` at the same path requires `email.send` and server-authorized tenant selections. Send raw `application/octet-stream` bytes, not JSON, a filename, a URL, or a client-provided verdict. The application authenticates before consuming the stream, rejects compressed/oversized/mismatched bodies, and bounds request reading. Responses are private/no-store. Disabled/unavailable service returns 503; provider-policy block returns 422; a completed clean scan returns 200. `releasable=false` is explicit: there is no durable quarantine/release service in this API.

## AI-Mail integration
The MIME reader assesses the complete parsed message before display truncation. Attachment bytes remain server-side; optional scanning begins only after IMAP lock release and connection cleanup. The browser and MCP receive safe inspection metadata, never file bytes. Reads remain available as plain-text review even when inspection blocks or errors; that does not release an attachment or remove mail from a mailbox.

The inbox distinguishes not inspected, disabled, no attachments, clean, blocked and error. A completed file scan does not claim sender authenticity, trustworthy links, or safe message content. Live mail is no longer labeled demo merely because an AI key is absent. AI availability has its own status. Delayed message/AI responses cannot overwrite a newer selection; UI tests exercise the actual component with a minimal hook/JSX harness, not a real browser.

`POST /api/ai` now accepts `{action, uid, instructions?}`. It rejects client-supplied email bodies, security flags, accounts and folders. The authenticated route checks mail-read permission, loads the current configured INBOX message server-side, then invokes the privacy gate. This preserves the application's existing shared-mailbox access model; it does not implement per-user mailbox ownership or persistent UIDVALIDITY-based identities.

Known full-MIME sensitive/high-risk findings remain authoritative even when the displayed body is shorter. The gate also examines all content selected for disclosure, sender fields and optional user direction before taking a 12,000-character excerpt. Detected private-key/card/SSN data, local hard-risk findings, known AI-directed instructions and incomplete required attachment scans prevent model invocation. Attachments are never included in the AI prompt. Generation has a separate system instruction, no tools, zero automatic retries, a 1,000-token output cap and a 20-second cancellation signal. Output is checked before return; uncertain/invalid output is not a successful result. This is defense in depth, not a complete prompt-injection defense or DLP certification.

## Validation and release
Native fixture tests cover configuration/egress, exact-byte hashes, malformed/threat replies, timeout/limit handling, authenticated upload boundaries, MIME cleanup-before-scan, AI input/output blocking, server-loaded requests, independent demo state and stale-response races. New tests are included in normal Vitest through `phase2-gate.test.ts`. Existing transport tests retain their assertions and explicitly disable external scanning in their fixtures.

Use PR #27 in r3alm-email-gateway and PR #4 in AI-Mail for exact hosted build revisions and verification evidence. AI-Mail PR #4 remains based on the unmerged phase-1 security PR #3. A preview build is not production readiness. Live scanner compatibility, authenticated browser verification, actual mail transport/database validation, rate limits, production configuration, lockfile reproducibility and the remaining dependency advisories require review before activation.

References: Cloudmersive Advanced Virus Scan API, https://api.cloudmersive.com/docs/virus.asp ; Vercel AI SDK generateText, https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text .
