# ASSIST Mail — SOVSI ID login release
Date: October 27, 2026

Canonical hostname: https://ai-mail.sovsi.xyz/login
Canonical sign-in provider: https://auth.sovsi.xyz
Exact registered callback: https://ai-mail.sovsi.xyz/identity/oauth/callback

## Changes
- Replaced the outdated r3alm S.I.-Mail login banner with SOVSI ID / ASSIST Mail typography, brand mark, responsive design and accessible focus states.
- Kept existing OAuth 2.1 code+PKCE, random state, nonce, signed JWT and AAL2 verification. There is no separate local password form or new-factor enrollment.
- Restricts return destinations to /inbox and /admin. Legacy domain requests redirect to canonical in the existing Next proxy. Other browser aliases return to canonical /login before authorization.
- Redesigned the OAuth callback, existing-factor challenge, loading and error states to match.
- Preserved all existing mailboxes, user identities, local roles, existing subject link mapping, and restricted mail session cookies.

## Release acceptance
1. Verify the central Auth Fabric ai-mail client and its exact callback are enabled.
2. Confirm existing identity-to-mailbox links and verified factors stay unchanged. Do not auto-provision rights.
3. Run complete npm verification, Vercel preview build and production build.
4. Check the actual canonical login page on desktop/mobile, keyboard tab focus and rejected authorization messaging.
5. Perform authorized user browser OAuth consent, AAL2/TOTP, /identity/oauth/callback, /inbox access and role-gated /admin rejection/approval. Test logout and recovery without resetting factors.
6. Ensure suspended, deleted or unmapped identities cannot create local sessions or see mailboxes.
7. If needed, roll back Vercel deployment; no schema or mail delivery changes are required.

The source and Vercel build tests cannot substitute for an interactive user sign-in.
