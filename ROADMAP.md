# AI-Mail roadmap

Updated September 25, 2026. Security work is on draft PR #4, stacked on authentication/transport PR #3. Neither is merged by this increment.

## Implemented in the security branch
- Shared local DLP and unsafe-link guards across browser/MCP SMTP sending; full-MIME local risk indicators and honest inbox warnings.
- Optional exact-byte Cloudmersive Advanced attachment inspection after IMAP cleanup, disabled by default. No file bytes are returned to the UI/MCP.
- Server-loaded AI requests: the client submits an INBOX UID, not an email body or permission verdict. Input/output privacy checks, bounded generation, no tool access and no automatic retries.
- Separate live-mail/demo and AI-availability indicators. Stale message/AI responses cannot replace a newer selection. Removed obsolete shared-password setup guidance.
- Focused native regression suites wired into Vitest. Exact full-repository hosted test/build evidence is recorded in PR #4.

## Next release gates
- Review PR #3, regenerate/commit a reproducible dependency lockfile, investigate the two previously observed full-graph moderate advisories, and rehearse the session-store migration.
- Complete MFA enrollment/challenge/recovery and mailbox ownership/scoped access; do not deploy the retained legacy apps/web tree.
- Validate authenticated desktop/mobile UI and actual SMTP/IMAP/database behavior in staging.
- Before scanner activation: approve external data processing, provider entitlement, rate limits/quotas and provider-contract behavior. Configuration is not a successful health probe.

## Remaining product work
1. Persistent security reports/incidents and the gateway-backed review queue.
2. True quarantine, stable UIDVALIDITY-based identity, MFA-controlled rescan/release and authorized postdelivery remediation.
3. Time-of-click URL protection and stronger impersonation/BEC detection.
4. Complete mailbox/folder ownership, delivery idempotency, safe forwarding/attachments and unfinished user-facing actions.

See [attachment scanning and AI privacy](docs/ATTACHMENT_SCANNING.md). The earlier [Proofpoint comparison](docs/EMAIL_SECURITY_ROADMAP.md) is historical: scanner and AI-privacy code has since been added, but production activation, real quarantine and enterprise feature parity are not complete.
