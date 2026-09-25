# Main integration and production release hold

Date: September 25, 2026.

The user requested that the email-security and AI-Mail improvements be committed to main. This integration includes the prerequisite authentication/transport remediation from PR #3 and the dependent security work from PR #4.

## Code integration is not production activation

`vercel.json` sets `git.deploymentEnabled.main` to `false`. This pauses automatic Vercel Git deployments for main only. Feature-branch previews and the existing verification build command remain enabled. It does not disable application login, change data, or alter the existing deployed application. Manual deployments and promotions are NOT prevented by this setting: operators must observe this release hold when using those paths too.

Reason: the new authentication code requires `supabase/migrations/20260921150000_revocable_browser_sessions.sql` before it serves production requests. The current Supabase connection denied permission to inspect migrations for the documented AI-Mail project `cvrihauikkflnvunmvma`, so the live schema could not be verified. Do not infer that the migration is applied, or that it is absent, from that authorization failure. A missing migration makes the new login path fail closed. Committing main must not replace a working production login with an unverified dependency.

## Conditions for lifting the hold

1. Use an authorized application-database connection to inspect migration history and the actual session/rate-limit schema. Back up and rehearse the additive session migration before applying it if absent. Do not rerun the initial schema or reset user records.
2. Verify individual administrator sign-in, database-backed session revocation, strong per-environment AUTH_SECRET, production demo isolation, and the documented MFA limitations. Full TOTP/MFA is not implemented by this merge.
3. Resolve the stale committed lockfile and inspect the two moderate findings reported by the full dependency installation. The production-only zero-vulnerability audit does not establish a clean full dependency graph.
4. Run the full existing verification suite and test authorized browser, OAuth, database and sandbox-mail flows on the release candidate. No live SMTP or mailbox action was authorized as a side effect of this merge.
5. In a reviewed release change, remove the `main: false` deployment hold and update `tests/phase1-production-hold.cjs` to match the approved release policy. Then rebuild/promote through the approved production process and verify health and individual sign-in.

External attachment scanning remains independently opt-in and must not be activated merely because the code has reached main. Scanner credentials, processing approval, provider entitlement, quotas and live contract tests remain required.

## Verification of this configuration change

The new configuration regression first failed against the original vercel.json (two failures, one unchanged build-gate check passing). After the main-only deployment hold was added, all three tests passed locally with `node --test tests/phase1-production-hold.cjs`. The existing verifier discovers `phase1-*.cjs`, so the hosted verification pipeline will run these checks alongside the existing suite. A complete fresh preview build is required before integration; local configuration checks alone are not an application build claim.

Vercel configuration reference: https://vercel.com/docs/project-configuration/git-configuration
