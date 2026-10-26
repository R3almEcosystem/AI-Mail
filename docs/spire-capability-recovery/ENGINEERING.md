# Detailed engineering requirements — AI-Mail

**30 atomic tasks** from the canonical v1 manifest. Do not alter task IDs or treat fixture data, passed builds or provider listings as proof of production operating capabilities.

AI-Mail OAuth is under active modernization. Preserve IMAP accounts, role identities, provider credentials and mailbox isolation; do not connect to or send mail on the strength of planning records.

## Per-epic requirements

## AI-Mail / S.I.A. Mail (`AIMAIL`)

**Source baseline:** L2: mailbox synchronization capability and central login, user acceptance pending

**Dependencies:** SOVSIID, GATEWAY · **Owner role:** Messaging Engineering · **Risk:** T2 · **Wave:** W2.

### AST-AIMAIL-E01: Mailbox ownership mapping

**Deliver:** Verify existing account can reconnect without new duplicate records

**Typed contract:** preserve IMAP identities, credentials, folder rights and delegated access

**Must reject:** Central login cannot read unrelated mailbox

- `AST-AIMAIL-E01-T01` **inventory: Establish ground-truth baseline: Mailbox ownership mapping**
  - Build: Inventory existing repository, database tables, Edge/server functions, Vercel routes, service owners and policy boundaries for preserve IMAP identities, credentials, folder rights and delegated access. Compare verified runtime behavior to the declared capability; mark anything untested or illustrative.
  - Acceptance: Dated baseline identifies actual versus simulated state for preserve IMAP identities, credentials, folder rights and delegated access, accountable owner, commit SHA, environment, contract gaps and threat paths; it explicitly notes: Central login cannot read unrelated mailbox.
  - Negative: Confirm 3 sampled claims against live read-only source IDs; produce a negative evidence case showing that central login cannot read unrelated mailbox.
  - Evidence: `evidence/aimail/01/baseline.json + gap-register.md`; prerequisite tasks: AST-SOVSIID-E01-T06, AST-GATEWAY-E01-T06; allowed mode: read_only.
- `AST-AIMAIL-E01-T02` **contract: Specify versioned engineering contract: Mailbox ownership mapping**
  - Build: Specify versioned types and API for preserve IMAP identities, credentials, folder rights and delegated access: tenant/entity, Mission ID, principal, region, classification, purpose, rights/license, event time, TTL, approval scope, idempotency and error states. Define explicit non-goals and interoperability with upstream/downstream modules.
  - Acceptance: JSON Schema/OpenAPI and migration proposal validate golden examples for preserve IMAP identities, credentials, folder rights and delegated access; implementation plan leads to: Verify existing account can reconnect without new duplicate records. No unreviewed access or irreversible change is implied.
  - Negative: Schema validator rejects missing ownership, changed action parameters and central login cannot read unrelated mailbox.
  - Evidence: `contracts/aimail/01/contract.schema.json + ADR.md`; prerequisite tasks: AST-AIMAIL-E01-T01; allowed mode: propose_only.
- `AST-AIMAIL-E01-T03` **implementation: Implement gated vertical slice: Mailbox ownership mapping**
  - Build: Implement the minimum testable mailbox ownership mapping capability for preserve IMAP identities, credentials, folder rights and delegated access in an allowlisted sandbox or reviewed preview; bind inputs to typed source contracts, real permission checks and immutable audit references. Build only the route necessary to demonstrate: Verify existing account can reconnect without new duplicate records.
  - Acceptance: Isolated feature branch contains code, migration and operator-visible status for preserve IMAP identities, credentials, folder rights and delegated access; sample transaction proves verify existing account can reconnect without new duplicate records without unapproved external side effects.
  - Negative: Feature defaults disabled, environment isolation holds, and central login cannot read unrelated mailbox.
  - Evidence: `pr/aimail/01/draft-implementation.diff + staged-smoke.json`; prerequisite tasks: AST-AIMAIL-E01-T02; allowed mode: draft_pr_sandbox.
- `AST-AIMAIL-E01-T04` **verification: Run positive, negative and adversarial tests: Mailbox ownership mapping**
  - Build: Build deterministic happy-path, failure, replay, concurrency, stale-data, tenant-isolation and privilege-boundary tests for preserve IMAP identities, credentials, folder rights and delegated access. Include prompt-injection or provider spoofing when the surface processes untrusted content.
  - Acceptance: Automated acceptance suite passes in isolated runner against real schema; test report independently establishes: Verify existing account can reconnect without new duplicate records; unresolved failures are explicit blockers.
  - Negative: Include at least one executable regression asserting: Central login cannot read unrelated mailbox. Assert no write or external side effect on denied request.
  - Evidence: `tests/aimail/01/golden.json + negative.json + CI-result.json`; prerequisite tasks: AST-AIMAIL-E01-T03; allowed mode: sandbox_tests.
- `AST-AIMAIL-E01-T05` **observability: Instrument evidence, SLOs and unit economics: Mailbox ownership mapping**
  - Build: Instrument preserve IMAP identities, credentials, folder rights and delegated access with trace_id, mission_id, source/version, policy evaluation, status, latency P50/P95, error counts, spend/quotas, freshness, operator owner and outcome quality. Record sampling/redaction and measurement windows.
  - Acceptance: Dashboard or trace can distinguish success, failure and indeterminate for preserve IMAP identities, credentials, folder rights and delegated access; named metric owners approve thresholds; evidence connects to target: Verify existing account can reconnect without new duplicate records.
  - Negative: Inject a simulated failure, stale observation and quota breach; metrics emit correct signal while preventing: central login cannot read unrelated mailbox.
  - Evidence: `observability/aimail/01/trace-sample.json + slo-evaluation.md`; prerequisite tasks: AST-AIMAIL-E01-T04; allowed mode: read_only.
- `AST-AIMAIL-E01-T06` **human_review: Prepare independent release and rollback packet: Mailbox ownership mapping**
  - Build: Assemble decision packet for mailbox ownership mapping: precise source SHA, contracts, security test results, data-rights evidence, rollback plan, reviewer identity and cost; submit to independent authorized human via Crucible/MANDATE. Do not execute release from SPIRE.
  - Acceptance: Packet is signed by the correct independent authority or marked HOLD, includes acceptance proof that verify existing account can reconnect without new duplicate records, and a tested rollback; no unsupported production-readiness claim.
  - Negative: Deny missing reviewer, expired grant, wrong artifact SHA, insufficient partner permission and this invariant: Central login cannot read unrelated mailbox.
  - Evidence: `releases/aimail/01/human-review-packet.json + rollback-proof.json`; prerequisite tasks: AST-AIMAIL-E01-T05; allowed mode: human_gate_only.

### AST-AIMAIL-E02: IMAP sync correctness

**Deliver:** Reconcile incrementally synced mailbox with provider state

**Typed contract:** UIDVALIDITY, cursor, pagination, attachments and dedupe

**Must reject:** UID rollover does not duplicate entire history

- `AST-AIMAIL-E02-T01` **inventory: Establish ground-truth baseline: IMAP sync correctness**
  - Build: Inventory existing repository, database tables, Edge/server functions, Vercel routes, service owners and policy boundaries for UIDVALIDITY, cursor, pagination, attachments and dedupe. Compare verified runtime behavior to the declared capability; mark anything untested or illustrative.
  - Acceptance: Dated baseline identifies actual versus simulated state for UIDVALIDITY, cursor, pagination, attachments and dedupe, accountable owner, commit SHA, environment, contract gaps and threat paths; it explicitly notes: UID rollover does not duplicate entire history.
  - Negative: Confirm 3 sampled claims against live read-only source IDs; produce a negative evidence case showing that uid rollover does not duplicate entire history.
  - Evidence: `evidence/aimail/02/baseline.json + gap-register.md`; prerequisite tasks: AST-AIMAIL-E01-T06; allowed mode: read_only.
- `AST-AIMAIL-E02-T02` **contract: Specify versioned engineering contract: IMAP sync correctness**
  - Build: Specify versioned types and API for UIDVALIDITY, cursor, pagination, attachments and dedupe: tenant/entity, Mission ID, principal, region, classification, purpose, rights/license, event time, TTL, approval scope, idempotency and error states. Define explicit non-goals and interoperability with upstream/downstream modules.
  - Acceptance: JSON Schema/OpenAPI and migration proposal validate golden examples for UIDVALIDITY, cursor, pagination, attachments and dedupe; implementation plan leads to: Reconcile incrementally synced mailbox with provider state. No unreviewed access or irreversible change is implied.
  - Negative: Schema validator rejects missing ownership, changed action parameters and uid rollover does not duplicate entire history.
  - Evidence: `contracts/aimail/02/contract.schema.json + ADR.md`; prerequisite tasks: AST-AIMAIL-E02-T01; allowed mode: propose_only.
- `AST-AIMAIL-E02-T03` **implementation: Implement gated vertical slice: IMAP sync correctness**
  - Build: Implement the minimum testable imap sync correctness capability for UIDVALIDITY, cursor, pagination, attachments and dedupe in an allowlisted sandbox or reviewed preview; bind inputs to typed source contracts, real permission checks and immutable audit references. Build only the route necessary to demonstrate: Reconcile incrementally synced mailbox with provider state.
  - Acceptance: Isolated feature branch contains code, migration and operator-visible status for UIDVALIDITY, cursor, pagination, attachments and dedupe; sample transaction proves reconcile incrementally synced mailbox with provider state without unapproved external side effects.
  - Negative: Feature defaults disabled, environment isolation holds, and uid rollover does not duplicate entire history.
  - Evidence: `pr/aimail/02/draft-implementation.diff + staged-smoke.json`; prerequisite tasks: AST-AIMAIL-E02-T02; allowed mode: draft_pr_sandbox.
- `AST-AIMAIL-E02-T04` **verification: Run positive, negative and adversarial tests: IMAP sync correctness**
  - Build: Build deterministic happy-path, failure, replay, concurrency, stale-data, tenant-isolation and privilege-boundary tests for UIDVALIDITY, cursor, pagination, attachments and dedupe. Include prompt-injection or provider spoofing when the surface processes untrusted content.
  - Acceptance: Automated acceptance suite passes in isolated runner against real schema; test report independently establishes: Reconcile incrementally synced mailbox with provider state; unresolved failures are explicit blockers.
  - Negative: Include at least one executable regression asserting: UID rollover does not duplicate entire history. Assert no write or external side effect on denied request.
  - Evidence: `tests/aimail/02/golden.json + negative.json + CI-result.json`; prerequisite tasks: AST-AIMAIL-E02-T03; allowed mode: sandbox_tests.
- `AST-AIMAIL-E02-T05` **observability: Instrument evidence, SLOs and unit economics: IMAP sync correctness**
  - Build: Instrument UIDVALIDITY, cursor, pagination, attachments and dedupe with trace_id, mission_id, source/version, policy evaluation, status, latency P50/P95, error counts, spend/quotas, freshness, operator owner and outcome quality. Record sampling/redaction and measurement windows.
  - Acceptance: Dashboard or trace can distinguish success, failure and indeterminate for UIDVALIDITY, cursor, pagination, attachments and dedupe; named metric owners approve thresholds; evidence connects to target: Reconcile incrementally synced mailbox with provider state.
  - Negative: Inject a simulated failure, stale observation and quota breach; metrics emit correct signal while preventing: uid rollover does not duplicate entire history.
  - Evidence: `observability/aimail/02/trace-sample.json + slo-evaluation.md`; prerequisite tasks: AST-AIMAIL-E02-T04; allowed mode: read_only.
- `AST-AIMAIL-E02-T06` **human_review: Prepare independent release and rollback packet: IMAP sync correctness**
  - Build: Assemble decision packet for imap sync correctness: precise source SHA, contracts, security test results, data-rights evidence, rollback plan, reviewer identity and cost; submit to independent authorized human via Crucible/MANDATE. Do not execute release from SPIRE.
  - Acceptance: Packet is signed by the correct independent authority or marked HOLD, includes acceptance proof that reconcile incrementally synced mailbox with provider state, and a tested rollback; no unsupported production-readiness claim.
  - Negative: Deny missing reviewer, expired grant, wrong artifact SHA, insufficient partner permission and this invariant: UID rollover does not duplicate entire history.
  - Evidence: `releases/aimail/02/human-review-packet.json + rollback-proof.json`; prerequisite tasks: AST-AIMAIL-E02-T05; allowed mode: human_gate_only.

### AST-AIMAIL-E03: AI mail assistance

**Deliver:** Produce grounded draft with human send approval

**Typed contract:** thread summarization, draft provenance and user consent

**Must reject:** Prompt content cannot trigger silent send

- `AST-AIMAIL-E03-T01` **inventory: Establish ground-truth baseline: AI mail assistance**
  - Build: Inventory existing repository, database tables, Edge/server functions, Vercel routes, service owners and policy boundaries for thread summarization, draft provenance and user consent. Compare verified runtime behavior to the declared capability; mark anything untested or illustrative.
  - Acceptance: Dated baseline identifies actual versus simulated state for thread summarization, draft provenance and user consent, accountable owner, commit SHA, environment, contract gaps and threat paths; it explicitly notes: Prompt content cannot trigger silent send.
  - Negative: Confirm 3 sampled claims against live read-only source IDs; produce a negative evidence case showing that prompt content cannot trigger silent send.
  - Evidence: `evidence/aimail/03/baseline.json + gap-register.md`; prerequisite tasks: AST-AIMAIL-E02-T06; allowed mode: read_only.
- `AST-AIMAIL-E03-T02` **contract: Specify versioned engineering contract: AI mail assistance**
  - Build: Specify versioned types and API for thread summarization, draft provenance and user consent: tenant/entity, Mission ID, principal, region, classification, purpose, rights/license, event time, TTL, approval scope, idempotency and error states. Define explicit non-goals and interoperability with upstream/downstream modules.
  - Acceptance: JSON Schema/OpenAPI and migration proposal validate golden examples for thread summarization, draft provenance and user consent; implementation plan leads to: Produce grounded draft with human send approval. No unreviewed access or irreversible change is implied.
  - Negative: Schema validator rejects missing ownership, changed action parameters and prompt content cannot trigger silent send.
  - Evidence: `contracts/aimail/03/contract.schema.json + ADR.md`; prerequisite tasks: AST-AIMAIL-E03-T01; allowed mode: propose_only.
- `AST-AIMAIL-E03-T03` **implementation: Implement gated vertical slice: AI mail assistance**
  - Build: Implement the minimum testable ai mail assistance capability for thread summarization, draft provenance and user consent in an allowlisted sandbox or reviewed preview; bind inputs to typed source contracts, real permission checks and immutable audit references. Build only the route necessary to demonstrate: Produce grounded draft with human send approval.
  - Acceptance: Isolated feature branch contains code, migration and operator-visible status for thread summarization, draft provenance and user consent; sample transaction proves produce grounded draft with human send approval without unapproved external side effects.
  - Negative: Feature defaults disabled, environment isolation holds, and prompt content cannot trigger silent send.
  - Evidence: `pr/aimail/03/draft-implementation.diff + staged-smoke.json`; prerequisite tasks: AST-AIMAIL-E03-T02; allowed mode: draft_pr_sandbox.
- `AST-AIMAIL-E03-T04` **verification: Run positive, negative and adversarial tests: AI mail assistance**
  - Build: Build deterministic happy-path, failure, replay, concurrency, stale-data, tenant-isolation and privilege-boundary tests for thread summarization, draft provenance and user consent. Include prompt-injection or provider spoofing when the surface processes untrusted content.
  - Acceptance: Automated acceptance suite passes in isolated runner against real schema; test report independently establishes: Produce grounded draft with human send approval; unresolved failures are explicit blockers.
  - Negative: Include at least one executable regression asserting: Prompt content cannot trigger silent send. Assert no write or external side effect on denied request.
  - Evidence: `tests/aimail/03/golden.json + negative.json + CI-result.json`; prerequisite tasks: AST-AIMAIL-E03-T03; allowed mode: sandbox_tests.
- `AST-AIMAIL-E03-T05` **observability: Instrument evidence, SLOs and unit economics: AI mail assistance**
  - Build: Instrument thread summarization, draft provenance and user consent with trace_id, mission_id, source/version, policy evaluation, status, latency P50/P95, error counts, spend/quotas, freshness, operator owner and outcome quality. Record sampling/redaction and measurement windows.
  - Acceptance: Dashboard or trace can distinguish success, failure and indeterminate for thread summarization, draft provenance and user consent; named metric owners approve thresholds; evidence connects to target: Produce grounded draft with human send approval.
  - Negative: Inject a simulated failure, stale observation and quota breach; metrics emit correct signal while preventing: prompt content cannot trigger silent send.
  - Evidence: `observability/aimail/03/trace-sample.json + slo-evaluation.md`; prerequisite tasks: AST-AIMAIL-E03-T04; allowed mode: read_only.
- `AST-AIMAIL-E03-T06` **human_review: Prepare independent release and rollback packet: AI mail assistance**
  - Build: Assemble decision packet for ai mail assistance: precise source SHA, contracts, security test results, data-rights evidence, rollback plan, reviewer identity and cost; submit to independent authorized human via Crucible/MANDATE. Do not execute release from SPIRE.
  - Acceptance: Packet is signed by the correct independent authority or marked HOLD, includes acceptance proof that produce grounded draft with human send approval, and a tested rollback; no unsupported production-readiness claim.
  - Negative: Deny missing reviewer, expired grant, wrong artifact SHA, insufficient partner permission and this invariant: Prompt content cannot trigger silent send.
  - Evidence: `releases/aimail/03/human-review-packet.json + rollback-proof.json`; prerequisite tasks: AST-AIMAIL-E03-T05; allowed mode: human_gate_only.

### AST-AIMAIL-E04: Attachment and threat scanning

**Deliver:** Reject malicious attachment before AI ingestion

**Typed contract:** quarantine, MIME validation, malware flags and data rights

**Must reject:** Unsafe file never reaches retrieval

- `AST-AIMAIL-E04-T01` **inventory: Establish ground-truth baseline: Attachment and threat scanning**
  - Build: Inventory existing repository, database tables, Edge/server functions, Vercel routes, service owners and policy boundaries for quarantine, MIME validation, malware flags and data rights. Compare verified runtime behavior to the declared capability; mark anything untested or illustrative.
  - Acceptance: Dated baseline identifies actual versus simulated state for quarantine, MIME validation, malware flags and data rights, accountable owner, commit SHA, environment, contract gaps and threat paths; it explicitly notes: Unsafe file never reaches retrieval.
  - Negative: Confirm 3 sampled claims against live read-only source IDs; produce a negative evidence case showing that unsafe file never reaches retrieval.
  - Evidence: `evidence/aimail/04/baseline.json + gap-register.md`; prerequisite tasks: AST-AIMAIL-E03-T06; allowed mode: read_only.
- `AST-AIMAIL-E04-T02` **contract: Specify versioned engineering contract: Attachment and threat scanning**
  - Build: Specify versioned types and API for quarantine, MIME validation, malware flags and data rights: tenant/entity, Mission ID, principal, region, classification, purpose, rights/license, event time, TTL, approval scope, idempotency and error states. Define explicit non-goals and interoperability with upstream/downstream modules.
  - Acceptance: JSON Schema/OpenAPI and migration proposal validate golden examples for quarantine, MIME validation, malware flags and data rights; implementation plan leads to: Reject malicious attachment before AI ingestion. No unreviewed access or irreversible change is implied.
  - Negative: Schema validator rejects missing ownership, changed action parameters and unsafe file never reaches retrieval.
  - Evidence: `contracts/aimail/04/contract.schema.json + ADR.md`; prerequisite tasks: AST-AIMAIL-E04-T01; allowed mode: propose_only.
- `AST-AIMAIL-E04-T03` **implementation: Implement gated vertical slice: Attachment and threat scanning**
  - Build: Implement the minimum testable attachment and threat scanning capability for quarantine, MIME validation, malware flags and data rights in an allowlisted sandbox or reviewed preview; bind inputs to typed source contracts, real permission checks and immutable audit references. Build only the route necessary to demonstrate: Reject malicious attachment before AI ingestion.
  - Acceptance: Isolated feature branch contains code, migration and operator-visible status for quarantine, MIME validation, malware flags and data rights; sample transaction proves reject malicious attachment before ai ingestion without unapproved external side effects.
  - Negative: Feature defaults disabled, environment isolation holds, and unsafe file never reaches retrieval.
  - Evidence: `pr/aimail/04/draft-implementation.diff + staged-smoke.json`; prerequisite tasks: AST-AIMAIL-E04-T02; allowed mode: draft_pr_sandbox.
- `AST-AIMAIL-E04-T04` **verification: Run positive, negative and adversarial tests: Attachment and threat scanning**
  - Build: Build deterministic happy-path, failure, replay, concurrency, stale-data, tenant-isolation and privilege-boundary tests for quarantine, MIME validation, malware flags and data rights. Include prompt-injection or provider spoofing when the surface processes untrusted content.
  - Acceptance: Automated acceptance suite passes in isolated runner against real schema; test report independently establishes: Reject malicious attachment before AI ingestion; unresolved failures are explicit blockers.
  - Negative: Include at least one executable regression asserting: Unsafe file never reaches retrieval. Assert no write or external side effect on denied request.
  - Evidence: `tests/aimail/04/golden.json + negative.json + CI-result.json`; prerequisite tasks: AST-AIMAIL-E04-T03; allowed mode: sandbox_tests.
- `AST-AIMAIL-E04-T05` **observability: Instrument evidence, SLOs and unit economics: Attachment and threat scanning**
  - Build: Instrument quarantine, MIME validation, malware flags and data rights with trace_id, mission_id, source/version, policy evaluation, status, latency P50/P95, error counts, spend/quotas, freshness, operator owner and outcome quality. Record sampling/redaction and measurement windows.
  - Acceptance: Dashboard or trace can distinguish success, failure and indeterminate for quarantine, MIME validation, malware flags and data rights; named metric owners approve thresholds; evidence connects to target: Reject malicious attachment before AI ingestion.
  - Negative: Inject a simulated failure, stale observation and quota breach; metrics emit correct signal while preventing: unsafe file never reaches retrieval.
  - Evidence: `observability/aimail/04/trace-sample.json + slo-evaluation.md`; prerequisite tasks: AST-AIMAIL-E04-T04; allowed mode: read_only.
- `AST-AIMAIL-E04-T06` **human_review: Prepare independent release and rollback packet: Attachment and threat scanning**
  - Build: Assemble decision packet for attachment and threat scanning: precise source SHA, contracts, security test results, data-rights evidence, rollback plan, reviewer identity and cost; submit to independent authorized human via Crucible/MANDATE. Do not execute release from SPIRE.
  - Acceptance: Packet is signed by the correct independent authority or marked HOLD, includes acceptance proof that reject malicious attachment before ai ingestion, and a tested rollback; no unsupported production-readiness claim.
  - Negative: Deny missing reviewer, expired grant, wrong artifact SHA, insufficient partner permission and this invariant: Unsafe file never reaches retrieval.
  - Evidence: `releases/aimail/04/human-review-packet.json + rollback-proof.json`; prerequisite tasks: AST-AIMAIL-E04-T05; allowed mode: human_gate_only.

### AST-AIMAIL-E05: Operational and audit visibility

**Deliver:** Show user attributable mailbox event and retry evidence

**Typed contract:** read/fetch/send status, error cluster, test proof and SLAs

**Must reject:** No private message body leaked to analytics

- `AST-AIMAIL-E05-T01` **inventory: Establish ground-truth baseline: Operational and audit visibility**
  - Build: Inventory existing repository, database tables, Edge/server functions, Vercel routes, service owners and policy boundaries for read/fetch/send status, error cluster, test proof and SLAs. Compare verified runtime behavior to the declared capability; mark anything untested or illustrative.
  - Acceptance: Dated baseline identifies actual versus simulated state for read/fetch/send status, error cluster, test proof and SLAs, accountable owner, commit SHA, environment, contract gaps and threat paths; it explicitly notes: No private message body leaked to analytics.
  - Negative: Confirm 3 sampled claims against live read-only source IDs; produce a negative evidence case showing that no private message body leaked to analytics.
  - Evidence: `evidence/aimail/05/baseline.json + gap-register.md`; prerequisite tasks: AST-AIMAIL-E04-T06; allowed mode: read_only.
- `AST-AIMAIL-E05-T02` **contract: Specify versioned engineering contract: Operational and audit visibility**
  - Build: Specify versioned types and API for read/fetch/send status, error cluster, test proof and SLAs: tenant/entity, Mission ID, principal, region, classification, purpose, rights/license, event time, TTL, approval scope, idempotency and error states. Define explicit non-goals and interoperability with upstream/downstream modules.
  - Acceptance: JSON Schema/OpenAPI and migration proposal validate golden examples for read/fetch/send status, error cluster, test proof and SLAs; implementation plan leads to: Show user attributable mailbox event and retry evidence. No unreviewed access or irreversible change is implied.
  - Negative: Schema validator rejects missing ownership, changed action parameters and no private message body leaked to analytics.
  - Evidence: `contracts/aimail/05/contract.schema.json + ADR.md`; prerequisite tasks: AST-AIMAIL-E05-T01; allowed mode: propose_only.
- `AST-AIMAIL-E05-T03` **implementation: Implement gated vertical slice: Operational and audit visibility**
  - Build: Implement the minimum testable operational and audit visibility capability for read/fetch/send status, error cluster, test proof and SLAs in an allowlisted sandbox or reviewed preview; bind inputs to typed source contracts, real permission checks and immutable audit references. Build only the route necessary to demonstrate: Show user attributable mailbox event and retry evidence.
  - Acceptance: Isolated feature branch contains code, migration and operator-visible status for read/fetch/send status, error cluster, test proof and SLAs; sample transaction proves show user attributable mailbox event and retry evidence without unapproved external side effects.
  - Negative: Feature defaults disabled, environment isolation holds, and no private message body leaked to analytics.
  - Evidence: `pr/aimail/05/draft-implementation.diff + staged-smoke.json`; prerequisite tasks: AST-AIMAIL-E05-T02; allowed mode: draft_pr_sandbox.
- `AST-AIMAIL-E05-T04` **verification: Run positive, negative and adversarial tests: Operational and audit visibility**
  - Build: Build deterministic happy-path, failure, replay, concurrency, stale-data, tenant-isolation and privilege-boundary tests for read/fetch/send status, error cluster, test proof and SLAs. Include prompt-injection or provider spoofing when the surface processes untrusted content.
  - Acceptance: Automated acceptance suite passes in isolated runner against real schema; test report independently establishes: Show user attributable mailbox event and retry evidence; unresolved failures are explicit blockers.
  - Negative: Include at least one executable regression asserting: No private message body leaked to analytics. Assert no write or external side effect on denied request.
  - Evidence: `tests/aimail/05/golden.json + negative.json + CI-result.json`; prerequisite tasks: AST-AIMAIL-E05-T03; allowed mode: sandbox_tests.
- `AST-AIMAIL-E05-T05` **observability: Instrument evidence, SLOs and unit economics: Operational and audit visibility**
  - Build: Instrument read/fetch/send status, error cluster, test proof and SLAs with trace_id, mission_id, source/version, policy evaluation, status, latency P50/P95, error counts, spend/quotas, freshness, operator owner and outcome quality. Record sampling/redaction and measurement windows.
  - Acceptance: Dashboard or trace can distinguish success, failure and indeterminate for read/fetch/send status, error cluster, test proof and SLAs; named metric owners approve thresholds; evidence connects to target: Show user attributable mailbox event and retry evidence.
  - Negative: Inject a simulated failure, stale observation and quota breach; metrics emit correct signal while preventing: no private message body leaked to analytics.
  - Evidence: `observability/aimail/05/trace-sample.json + slo-evaluation.md`; prerequisite tasks: AST-AIMAIL-E05-T04; allowed mode: read_only.
- `AST-AIMAIL-E05-T06` **human_review: Prepare independent release and rollback packet: Operational and audit visibility**
  - Build: Assemble decision packet for operational and audit visibility: precise source SHA, contracts, security test results, data-rights evidence, rollback plan, reviewer identity and cost; submit to independent authorized human via Crucible/MANDATE. Do not execute release from SPIRE.
  - Acceptance: Packet is signed by the correct independent authority or marked HOLD, includes acceptance proof that show user attributable mailbox event and retry evidence, and a tested rollback; no unsupported production-readiness claim.
  - Negative: Deny missing reviewer, expired grant, wrong artifact SHA, insufficient partner permission and this invariant: No private message body leaked to analytics.
  - Evidence: `releases/aimail/05/human-review-packet.json + rollback-proof.json`; prerequisite tasks: AST-AIMAIL-E05-T05; allowed mode: human_gate_only.
