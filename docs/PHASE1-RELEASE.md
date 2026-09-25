# Phase 1 security and mail remediation — September 21, 2026

## Scope and evidence

Base: main `0b0a1e21c6349e6ee0df610c9b02bff57d9a513a`. The active root Next.js application and MCP mail implementation are changed. `apps/web` is retained legacy code, not remediated or approved for deployment.

Local verification: 55 native Node regression checks passed against TypeScript production modules with isolated external-service adapters. Original failing behavior was reproduced for preview signing, demo isolation, stale cookie authorization, OAuth callback data loss, all five IMAP actions, and browser-send authorization/configuration. Additional login/logout tests cover shared-password rejection, account status, MFA fail-closed behavior, throttling, and durable logout failure. These are not live-mail, actual PostgreSQL, complete Zod-schema, browser, or full-build tests.

The local runner cannot access the package registry or GitHub network. Dependencies were not installed and the existing Vitest suite, compiler, framework build, gateway build, SQL migration tests, and production dependency scan are NOT claimed as passing locally. The dedicated GitHub workflow runs those gates and refreshes the lockfile on this exact remediation branch only. The PR must remain draft until its exact final revision passes and the generated lockfile is committed.

## Changed controls

- Browser cookies use version 2 and a cryptographically random session identifier; only its SHA-256 hash is stored. Signed claims alone never authorize live data.
- Session resolution joins the current active account, session revocation/expiry, account authentication version, and workspace MFA policy. Password, role, email, suspension, deletion, and reactivation changes invalidate prior sessions via a database trigger. Logout durably revokes the session before clearing its cookie.
- AUTH_SECRET must contain at least 32 bytes, including on previews. The predictable preview fallback and APP_ACCESS_PASSWORD login path are removed.
- Demo login requires explicit isolated nonproduction mode and refuses all configured database URLs or live mail/AI/admin credentials. Mail/AI demo branches cannot call providers.
- Operation guards enforce Viewer read-only access, current administrator privileges, same-origin browser writes, and no-store responses for private mail. Configured live requests never silently become simulated success.
- Browser and MCP share one mail transport implementation. Recipient allowlists, counts, message bounds, validated TLS, timeouts, source-size checks, command completion/result checks, and honest SMTP/Sent-copy outcomes are enforced at that implementation.
- OAuth resumption preserves query parameters and URL fragments until the consent client consumes them. Login return paths reject external or malformed destinations.
- Nodemailer is pinned to 10.0.10. Active Mailparser and its transitive parser stack are removed in favor of the existing PostalMime parser with nesting/size limits. Other previously floating dependencies are pinned to their audited locked versions. A fresh successful dependency audit remains a release gate.

## Required order before production promotion

1. Back up the application database and rehearse on an isolated database. Apply `supabase/migrations/20260921150000_revocable_browser_sessions.sql` using the approved migration process. It adds server-only session and sign-in-limit tables and an account-version trigger; it does not delete accounts or mailbox records. Do not replace or re-run the initial schema against an existing database.
2. Ensure an active individual Super Admin with a working salted password hash exists. The existing ADMIN_INITIAL_PASSWORD bootstrap remains available for controlled initial provisioning; APP_ACCESS_PASSWORD is no longer a login method. Verify the individual login on staging before removing any emergency access arrangements.
3. Set an independent random AUTH_SECRET of at least 32 bytes in each environment. Keep production ENABLE_DEMO_LOGIN false/unset. The migration must exist before new login code serves traffic; missing schema fails closed.
4. Confirm the refreshed committed package lock, Node 22 build, existing tests, native security tests, PostgreSQL tests, and dependency audit all pass on the same revision. Validate fresh OAuth login with no pre-existing Supabase browser session. Test approved synthetic mail against a sandbox SMTP/IMAP account, including partial rejection and failed Sent archival.
5. Promote only after authorization and migration review. All previous browser cookies are intentionally invalidated; users must sign in again. No production promotion, migration, secret rotation, real email, or account mutation was performed during this implementation.

## MFA limitation — not an MFA implementation

`require_mfa=true` now blocks password-only sessions and login. This is containment, NOT TOTP enrollment, a challenge, recovery, or AAL2 support. The settings API rejects new MFA-policy activation with MFA_NOT_AVAILABLE rather than locking out the workspace. Do not enable the flag out of band as a substitute for implementing that flow. A future MFA implementation must use issuer `r3alm`, app/role-specific labels such as `AI-Mail Admin`, and canonical `ai-mail.r3alm.com` callback/recovery URLs. Existing MFA-required workspaces need an approved MFA-capable identity flow before this direct login can be used.

## Operations and follow-up

The identity throttle permits ten attempts per 15-minute window and is shared across server instances. Add an edge/global abuse limit for unknown-account floods; this per-identity limiter is not a complete denial-of-service control. Periodically delete expired sessions and throttle windows older than 24 hours using a reviewed maintenance job. Retain security audit records according to approved policy.

Legacy UI logout handlers may redirect after an API failure; the API correctly preserves the retry cookie and returns 503 when revocation fails. Do not interpret navigation alone as successful logout. Complete UI recovery and integrated session-expiry handling in the next product pass.

MCP OAuth scopes, per-tool approvals, account-to-mailbox ownership, delivery idempotency/reconciliation, full MFA, durable alerts/invitations, and full browser workflow regression remain separate work. This change is not a production-readiness certification.
