# SOVSI ID AI-Mail rollout

Source baseline: main `831466a32a740fb36814a24b7c6dad9811586c39`.

Canonical web origin: `https://ai-mail.sovsi.xyz`; central portal key `ai-mail`; callback `/identity/oauth/callback`. The existing ai-mail.r3alm.com browser pages redirect to the canonical origin. MCP/API endpoints retain their existing separate routing and authorization.

Apply the identity-session migration before deploying. It adds only explicit identity links and encrypted session fields; existing users, roles, auth versions, mailbox accounts, Vault secrets and IMAP/SMTP connections remain intact. Three exact reviewed existing-account mappings are included. Bernie retains his local super_admin role but remains unable to authenticate while his central email is unconfirmed; this rollout does not confirm that email.

The browser completes public OAuth with PKCE, state, OIDC nonce and central MFA, then establishes a server session. OAuth credentials are transient in the browser. The existing HttpOnly cookie remains an opaque signed local lookup credential. Central tokens are encrypted at rest using AES-256-GCM, domain-separated from the existing server AUTH_SECRET (or existing MCP secret fallback), and bound to the local session hash. Existing local-role/auth-version changes and session revocation remain authoritative. Each protected request independently verifies the central signature, exact client, verified factor, confirmed email and live central membership. Refresh preserves the central subject and session ID. Central outages fail closed.

Normal local password login is retired. No third-party issuer integration is needed in AI-Mail's Supabase Data API because browser requests use the existing server PostgreSQL boundary.

Verification includes Next build, TypeScript, standalone MCP gateway TypeScript, existing mail/authorization regressions, signed-JWT negative cases and actual PostgreSQL WASM tests exercising the production session SQL, encryption, revocation, local role changes, and mapping revocation. Verification uses synthetic data and does not connect to or change a mailbox.

The release gate keeps its production dependency audit at moderate severity. The existing lockfile was synchronized with declared package versions; required security updates pin nodemailer 10.2.1, zod 4.6.7 and undici 7.30.1, plus the patched compatible body-parser transitive release. The full isolated verification script runs before Vercel builds.
