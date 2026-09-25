# r3alm email security: Proofpoint-informed implementation and roadmap

**Date:** September 25, 2026  
**Repositories:** r3alm-email-gateway and AI-Mail  
**Status:** Initial code increment; draft review, not production activation or Proofpoint parity.

## What we learned
Proofpoint treats an email gateway as layered protection, not just a sending API. Its reference covers filtering, threat detection, outbound protection and quarantine [1]. Its broader portfolio adds adaptive DLP [2], domain authentication/anti-spoofing [3] and URL defense [4]. These capabilities are not all supplied by one interchangeable product or one heuristic ruleset.

For r3alm, the email-gateway should own shared policy enforcement, delivery controls, audit and eventual threat-service orchestration. AI-Mail should consume server-side security evidence, explain risk, support investigation/reporting, and keep AI assistance subordinate to message security and user authority. The existing SMTP/IMAP service remains the transport; this increment does not put r3alm in the inbound MX path.

## Implemented in this increment

| Capability | Gateway | AI-Mail | Important boundary |
|---|---|---|---|
| Shared, versioned local security rules | Added | Identical engine added | Rules-only; no proprietary threat intelligence |
| Outbound DLP indicators | Before new acceptance and before dispatch | Before shared browser/MCP SMTP send and replies | Private-key markers, selected card-network/length/Luhn checks, labelled structurally valid SSNs; not complete DLP |
| URL indicators | Enforced for hard matches | Outbound enforcement and inbound warnings | Active/local-resource schemes and embedded credentials block; HTTP, IP/IDN hosts and displayed-link mismatch warn; no live reputation lookup |
| Attachment metadata risk | Available to assessment API | Inspected from parsed MIME metadata | Executable/script and macro-enabled filenames/MIME trigger high risk; archives and ordinary files remain unscanned |
| Social-engineering indicators | Assessment | Inbound assessment | Reply-to mismatch, urgency/payment combination, credential requests and AI-targeted instructions are heuristics, not proven fraud |
| Authenticated assessment endpoint | `POST /api/v1/security/assess`, `email.send` authority, bounded JSON | Can be consumed by authorized integrations | Returns information, not delivery acceptance or a reusable clearance token; tenant selection remains server-validated |
| Honest protection status | Redacted structured assessment | Inbox security panel with icons, reasons and explicit coverage | Always says authentication not verified, malware not scanned, URL reputation not checked, attachment contents not scanned |
| Security-block UX | Public-safe `POLICY_BLOCKED` response | HTTP 422 with redacted reasons shown in compose | Does not emit detected secrets or full URLs in findings |
| Safe compose confirmation | Existing accepted-message lifecycle retained | Requires explicit acceptance receipt; retains draft on uncertain response; handles network errors and clears sending state | SMTP acceptance is not final recipient delivery; never automatically resend after uncertain acceptance |
| Bounded processing | Input/metadata/link limits and linear malformed-markup handling | Same | Limits fail closed; no silent safe verdict after truncation |

### Precise enforcement behavior
New gateway messages are assessed after rendering, so template substitutions are included. The policy check occurs before quota consumption or new acceptance persistence. Compatible idempotent replays remain acknowledgements of an existing immutable message; the worker checks the stored bytes again before provider selection and send.

The current queue schema has no dedicated security-incident code. A policy denial during dispatch uses its existing permanent `dead_letter` decision and `internal_error` code. This intentionally stops delivery without introducing an unverified migration. It does **not** provide a rich threat quarantine, dedicated incident reporting or a release workflow. Policy-denied new submissions are not stored as security incidents in this increment.

AI-Mail's single `MailGateway` implementation covers browser and MCP send/reply. Reads assess full parsed text/HTML before display truncation and include attachment metadata. Inbox warnings do not move, delete or quarantine a message. No `Authentication-Results` header is accepted as proof merely because it exists in received mail. Existing demo and production boundaries are retained.

Hard-rule findings prevent outgoing delivery. Advisory findings do not automatically block legitimate urgent mail, IDNs or all attachments. The attachment rules do not examine file bytes. Encoded, encrypted, image-only, nested or deliberately obfuscated content can evade local indicators. Do not use these rules as a replacement for a real malware/DLP service.

## Work still required for enterprise protection

### P0 — release and authority prerequisites
- Review and integrate AI-Mail phase-1 security PR #3 before this stacked increment reaches main. Its existing lockfile/dependency-audit, session-store migration, MFA and legacy `apps/web` release constraints are not solved here.
- Run each complete repository's locked dependency install, full tests, type checks, lint, production build and dependency audit in an authorized runner. Review coverage gates; native integration fixtures do not prove the real database or transport works.
- Validate a preview with a synthetic mailbox, allowed and denied test mail, actual provider receipts, tenant isolation, viewer restrictions, authentication failures, scheduling and suppression. Check inbox/compose visually on desktop and mobile.
- Establish policy ownership, false-positive triage, emergency stop and rollback controls. Assess whether financial data belongs in email at all; do not add a broad bypass just to make test messages send.

**Exit:** Both repository CI/build gates and staging checks pass; security ownership and rollback are approved. No production claims before this gate.

### P1 — trusted intake, real scanners and durable incidents
- Add authenticated Exim/MTA or inbound-provider ingestion with raw-message hashes, scoped envelope metadata, replay protection and body-size limits. Validate SPF/DKIM/DMARC in the trusted receiving layer; strip or separate untrusted authentication headers.
- Add provider-neutral malware/reputation adapters with bounded timeouts, exact-byte/hash binding, declared provider health, rate/size limits and data-residency controls. Required scanning must fail closed on error or unknown/pending status.
- Introduce tenant-scoped security policies, verdicts and incidents with RLS, immutable redacted audit events, policy-version history, reason codes and no secret/body snippets in routine logs.
- Connect evidence-backed incident metrics and alerts to r3alm Monitor. Distinguish blocked, pending, errored, unscanned and delivered mail; do not fabricate counts from demonstration data.

**Exit:** Synthetic clean/malicious/error fixtures prove exact-content verdict binding, tenant isolation, fail-closed behavior and durable incident traceability.

### P2 — real quarantine, user reporting and remediation
- Implement persistent quarantine state and encrypted retention; use stable identities including mailbox scope, UIDVALIDITY and UID rather than a folder label alone.
- Add Report phishing / Report safe workflows with authenticated actors, idempotency, redacted evidence and review ownership. A star/flag is not a security report.
- Require scoped administrator authority, a fresh strong-authentication session, reason and rescan before release. No end-user malware override; no blanket allow-list bypass of hard controls.
- Add postdelivery search/removal with dry run, bounded scope, explicit authorization, immutable audit and compensating actions where supported.

**Exit:** Report-to-review-to-rescan-to-release/remediation flows are tested end to end, including concurrent requests, failed moves and incorrect mailbox identifiers.

### P3 — advanced prevention and information protection
- Add signed time-of-click URLs and a reputation decision service, with canonicalization, SSRF defense, redirect limits, no open redirect and revocation. Model how rewriting affects signatures and privacy [4].
- Add attachment detonation/CDR, nested archive inspection and explicit encrypted-file policies. Metadata warnings are not sandbox verdicts.
- Add protected executive identities, lookalike-domain checks and behavior-based BEC/account-compromise detection with measured false-positive rates and explainable evidence.
- Expand DLP with tenant-specific classification, recipient context, exceptions with approval/expiry, secure-message delivery/encryption, journal/archive retention and legal-hold requirements.

**Exit:** Benchmarked effectiveness, defined operational costs, provider contracts and documented limitations; no invented accuracy percentage.

### P4 — operations and resilience
Add delivery continuity/secondary transport only with deduplication and uncertain-acceptance handling, incident-response SLAs, queue backpressure, abuse controls, assessment rate limits, audit export/SIEM integration, disaster recovery and periodic adversarial testing. Track false positives and unknown verdicts alongside detection, not only successful sends.

## Assessment API
An authorized application sends JSON containing `subject`, `text`, optional `html`, optional `from`/`replyTo` and optional attachment metadata (`filename`, `mimeType`). Bearer authorization with `email.send` is required. Existing organization/workspace/environment selection headers may be used within the principal's authority.

The endpoint fixes outbound policy server-side. `direction`, `allow`, `authenticated`, `scanVerdict` or other client assertions do not override rules. HTTP 200 means assessment completed, not that mail was accepted or safe. Inspect `assessment.disposition`: `block`, `review` or `no_local_match`. Malformed/oversized JSON follows existing bounded-request errors. Invalid content structure produces an explicit blocking finding. Responses are private and not cached.

Current core limits: 2,100,000 subject/text/HTML characters combined; 100 attachments; filename 512 characters; MIME type 256; address fields 512; 200 distinct link candidates; 1,000 total link candidates; individual links 4,096 characters. Additional displayed-link markup bounds can produce `inspection_limit`. Gateway transport byte limits still apply independently.

## Verification and rollout
The same 33 rule cases are wired to both the Node runner and the normal Vitest entry point; only the Node execution was verified here. Native integration checks execute the actual changed acceptance/dispatch/mail modules with explicit database/provider/parser fixtures. They prove control-flow behavior, not live infrastructure success. An adversarial malformed-markup regression runs in a bounded child process. The compose-result tests reject malformed acknowledgements.

Observed locally: gateway 45 native tests pass; AI-Mail 46 native tests pass. Strict standalone TypeScript checks pass for the pure security core, gateway domain errors/shared test cases, and AI-Mail send-result parser. Selected TS/TSX files also pass syntax transpilation. These are **not** full application build/typecheck claims. The local working copies contain selected connector-fetched files; external DNS/package access is unavailable. `npx --offline vitest run` cannot run because Vitest is not cached. Full repository suites, production builds, live SMTP/IMAP, database tests and browser rendering remain release gates.

No production DNS, SMTP credentials, database schema or mailboxes were changed. No real email was sent for these checks. Review as draft PRs; do not promote automatically. Before rollback, pause dispatch and review policy-stopped messages. Never automatically replay dead letters after removing a guard.

## Reference sources
[1] Proofpoint, Email Gateway reference: https://www.proofpoint.com/us/threat-reference/email-gateway  
[2] Proofpoint, Adaptive Email DLP: https://www.proofpoint.com/us/products/adaptive-email-dlp  
[3] Proofpoint, Email Fraud Defense: https://www.proofpoint.com/us/products/email-fraud-defense  
[4] Proofpoint, URL Defense troubleshooting and behavior: https://help.proofpoint.com/proofpoint_essentials/email_security/administrator_topics/other_features/troubleshooting_issues_with_url_defense
