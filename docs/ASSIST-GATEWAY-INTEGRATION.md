# AI-Mail ↔ ASSIST ↔ ASSIST Email Gateway

## Current integration state
A server-only client has been committed to AI-Mail, **disabled by default**.
The gateway's `POST /v1/messages` endpoint is not present in its current GitHub main branch; this client must not be enabled or advertised as a live mail route until the endpoint, authentication, quota and delivery worker exist.

## Architecture
AI-Mail remains the authenticated inbox and IMAP client for r3alm mail. ASSIST manages approved workflow decisions. The ASSIST Email Gateway owns outbound template-based notifications, suppression, delivery state, provider callbacks and audit. NEXUS routes events rather than directly sending SMTP.

AI-Mail can use `requestAssistGatewayDelivery` from `src/lib/assist-gateway.ts` only in authenticated server routes. Never export its bearer or service credentials to the browser, and never let the AI model invoke it directly without explicit user/role and MANDATE approvals.

## Required private environment values (AI-Mail)
- `ASSIST_EMAIL_GATEWAY_ENABLED=false` until end-to-end verification.
- `ASSIST_EMAIL_GATEWAY_URL=https://email.sovsi.xyz/` only after that hostname serves the approved gateway API.
- `ASSIST_EMAIL_GATEWAY_SERVICE_TOKEN` (unique long-lived bootstrap secret, rotate to short-lived scoped identity).
Do not use the gateway Supabase service-role key as a client credential.

## Must be completed before activation
1. Gateway implements `POST /v1/messages` and validates signed identity, tenant + integration scopes, template, recipient policy, idempotency and quotas; reject all requests without valid identity.
2. Provision a dedicated, tenant-scoped **ai-mail** service principal; store its secret only in Vercel server-side environment.
3. Integrate AI-Mail's authenticated server route with confirmation/approval checks; use the connector rather than direct arbitrary model sends.
4. Map message correlation IDs to ASSIST run IDs and NEXUS event IDs.
5. Ensure provider callback -> gateway delivery ledger -> alert/NEXUS outbox.
6. Test invalid token rejection, tenant isolation, suppression, template disable, idempotent retry, successful message acceptance, signed delivery webhook and bounce alert.
7. Only then enable the flag.

No live mail was sent by this change.
