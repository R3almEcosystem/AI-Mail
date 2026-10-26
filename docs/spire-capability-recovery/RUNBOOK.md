# SPIRE and human operator runbook — AI-Mail

1. Establish owner, current repo SHA/branch, Vercel project/root/build mode and Supabase identity/tenant boundaries.
2. Review existing mainline and feature-branch PRs before touching files. Do not merge/replace active work under a documentation task.
3. Inspect all planned task dependencies, negative tests, risk tier and `spire_mode`; snapshot observed state and redact secrets.
4. Confirm lawful data/source/customer rights and independent service-provider authority. Missing rights fail closed.
5. SPIRE may inventory and draft a proposal; separate humans approve any sandbox PR, privileged test, account change, outreach, production release or payment.
6. Run reproducible tests for normal and revoked/incorrect credentials, wrong tenant, repeated messages, timeouts, retries, rollback and authenticated audit.
7. Independent reviewer verifies actual resulting behavior and signed source/receipt before marking the specific task Verified/Closed.

## STOP conditions
Provider secrets or mail in a public trace; unauthorized outbound email; missing unsubscribe/consent; cross-mailbox read; changes to Auth users/MFA; ambiguous replay; unapproved live integration; deployment mismatch.

## Epic order

- **AST-AIMAIL-E01** Mailbox ownership mapping: Verify existing account can reconnect without new duplicate records. Explicitly deny Central login cannot read unrelated mailbox.

- **AST-AIMAIL-E02** IMAP sync correctness: Reconcile incrementally synced mailbox with provider state. Explicitly deny UID rollover does not duplicate entire history.

- **AST-AIMAIL-E03** AI mail assistance: Produce grounded draft with human send approval. Explicitly deny Prompt content cannot trigger silent send.

- **AST-AIMAIL-E04** Attachment and threat scanning: Reject malicious attachment before AI ingestion. Explicitly deny Unsafe file never reaches retrieval.

- **AST-AIMAIL-E05** Operational and audit visibility: Show user attributable mailbox event and retry evidence. Explicitly deny No private message body leaked to analytics.
