# ASSIST Mail release audit — 2026-10-23

## Scope
Reviewed repository configuration, the Vite portal scaffold, legacy Next.js server architecture, production Vercel build logs, regression tests, and known AI-Mail identity/mailbox preservation requirements.

## Findings and repairs
- The existing Vercel `ai-mail` project builds from repository root using Next.js. The Vite portal is separately scaffolded in `portal/`, **not** a drop-in replacement for the Next.js backend.
- Rebrand-related static regression assertions caused failed production builds. Updated the legacy tests to expect S.I.A. terminology; preserved the underlying access and mailbox assertions.
- Security audit gate identified vulnerable pinned versions in MCP, Next.js and ip-address. Updated dependency declarations to audited fixed releases; this is **not** proof that dependency audit and runtime compatibility now pass.
- Added independent `portal/` build workflow to catch static Vite regressions.
- No authorization tables, mailbox identities, IMAP endpoints, credentials or current users were modified during this pass.

## Release blockers
1. The Vite portal is a **non-authenticated introductory shell** only. Do not expose private mailbox functions through static hosting.
2. Move authenticated login/MFA, user permissions, IMAP/SMTP, MCP and delivery integration to a protected server API before cutting over Vercel from Next.js to Vite.
3. Validate current `admin@sovsi.xyz` sign-in with an actual user session (do not solicit or log passwords).
4. Verify Vite build, automated security tests, dependency audit and a real provider delivery/alert event.
5. Refresh and commit both root and portal package lockfiles using trusted package manager and confirmed dependency tree. Root security package declarations changed during this pass.
6. Stage/test Vite deployment in a separate project before switching production domains; retain rollback path.

## Acceptance
- All CI checks green
- Existing users and connected mailboxes accessible
- Correct owner/super-admin controls and MFA
- No client-side service-role or IMAP secrets
- Delivery confirmation shown as provider evidence (not merely queued)
- Tested rollback for frontend routing

This document is an audit record; it does not claim production Vite migration completion.
