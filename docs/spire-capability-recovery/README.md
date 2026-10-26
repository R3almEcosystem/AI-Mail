# AI-Mail — SPIRE capability recovery

**Baseline:** 2026-10-26 · **Scope:** engineering planning, Not started · **Authority:** none granted.

**Canonical source:** [ASSIST-V2 proposal #159](https://github.com/R3almEcosystem/ASSIST-V2/pull/159) · [engineering/master runbooks](https://github.com/R3almEcosystem/ASSIST-V2/tree/docs/spire-capability-recovery-20261026/docs/engineering/spire-capability-recovery).

Module mirrors: AI-Mail / S.I.A. Mail (5 epics, 30 tasks). This project retains its own separate deployment, authentication and operational authority; the mirrored tasks are not action tickets.

**Current boundaries:** AI-Mail OAuth is under active modernization. Preserve IMAP accounts, role identities, provider credentials and mailbox isolation; do not connect to or send mail on the strength of planning records.

## Documents
- [Engineering requirements](ENGINEERING.md)
- [Operator runbook](RUNBOOK.md)
- [Release and evidence gates](RELEASE_ACCEPTANCE.md)
- Original task IDs/dependencies and negative tests: `tasks/<MODULE>.json`.

The planning import does not authorize issue creation, deployment, email sending or environment modification.
