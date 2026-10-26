# Release, failure and evidence gates — AI-Mail

Proposed tasks confer no operational authority. Evidence must bind `task_id`, exact source SHA and artifact hashes, tenant/region, current permission/contract, positive+negative tests, independent reviewer, expiry, rollback and verified postconditions. Never attach raw mailbox/password/token content to logs or tickets.

A document merge is not a production release. User-facing claims must match observed behavior, not planned modules.

## Epic closure criteria

- **AST-AIMAIL-E01** Mailbox ownership mapping: prove actual Verify existing account can reconnect without new duplicate records and independently test Central login cannot read unrelated mailbox; all 6 tasks require evidence and external review.

- **AST-AIMAIL-E02** IMAP sync correctness: prove actual Reconcile incrementally synced mailbox with provider state and independently test UID rollover does not duplicate entire history; all 6 tasks require evidence and external review.

- **AST-AIMAIL-E03** AI mail assistance: prove actual Produce grounded draft with human send approval and independently test Prompt content cannot trigger silent send; all 6 tasks require evidence and external review.

- **AST-AIMAIL-E04** Attachment and threat scanning: prove actual Reject malicious attachment before AI ingestion and independently test Unsafe file never reaches retrieval; all 6 tasks require evidence and external review.

- **AST-AIMAIL-E05** Operational and audit visibility: prove actual Show user attributable mailbox event and retry evidence and independently test No private message body leaked to analytics; all 6 tasks require evidence and external review.
