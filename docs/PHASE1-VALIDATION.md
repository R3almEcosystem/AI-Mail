# Phase 1 verification continuation — 2026-09-21

The Vercel build command now requires `node scripts/verify-core.cjs` to succeed before the normal Next.js build. The gate runs the installed TypeScript checker, existing Vitest suite, every `tests/phase1-*.cjs` regression, standalone gateway compiler, and `npm audit --omit=dev --audit-level=moderate`. It rejects missing tools, nonzero exits, signals, and subprocess timeouts. It does not disable or replace required GitHub checks.

Verification child processes receive an allowlisted environment, not deployment secrets or database credentials. The dependency audit uses a temporary home directory and deletes it after execution. Eight native tests exercise this gate; they were observed failing before implementation and passing locally afterward. Their synthetic npm command verifies audit argument/error handling, not the real dependency vulnerability report.

## PostgreSQL integration coverage

`tests/phase1-postgres.cjs` uses the pinned, development-only PGlite dependency to create a fresh in-memory PostgreSQL instance. It executes the exact committed SQL migrations and invokes the production session-store functions. Only the network/wire adapter is replaced; the SQL itself is not mocked. No production database, account or mailbox is opened or modified.

Sixteen test cases cover bootstrap conflict handling, active-session resolution, repeated logout, password/role/status/email changes, suspension/reactivation, last-login updates, expiry, credential-snapshot races, MFA policy refusal, login-limit boundaries/window renewal, hashed session identifiers, and public-role table restrictions.

This is not a full Supabase deployment rehearsal, a PostgreSQL wire-protocol test, a multi-connection race test, or full browser/SMTP/OAuth verification. The existing `tests/session-revocation.sql` remains a separate real-server CI test with its own synthetic-database guard.

## Release blockers remain explicit

- The committed package-lock.json must be regenerated and committed, followed by clean `npm ci` verification. Vercel's current `npm install` can update a build-local lockfile; that does not repair the Git artifact or establish reproducibility.
- GitHub Actions job execution must be restored. Failures observed before any steps start do not establish a code/test failure or a specific billing diagnosis.
- Rehearse the migration and individual-administrator login in an approved staging database; then apply the additive migration before production promotion.
- Verify fresh OAuth authorization and sandbox mailbox operations through the authenticated preview.
- Complete security review. Full TOTP enrollment/challenge/recovery is still outside this containment patch.

Do not promote solely because a preview is READY. Match the deployment revision to the commit, inspect the gate result, complete the remaining checks, and preserve the existing production deployment until release requirements are met.
