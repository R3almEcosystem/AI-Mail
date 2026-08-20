# r3alm AI-Mail

A secure Next.js management console for `ai-mail.r3alm.com`. The application provides:

- Executive inbox overview and priority queue
- Live IMAP mailbox listing and message retrieval
- SMTP compose and delivery
- OpenAI summaries, reply drafts, task extraction, and priority analysis
- Server-side connection health without exposing credentials
- Public product landing page and credential login
- One-click Bernie demo account for preview deployments
- Signed HTTP-only sessions with five role levels
- Full user lifecycle management: create, invite, edit, suspend, reactivate, and soft-delete
- Full-height Alert Center with expandable detail, resolution, snooze, and group escalation actions
- Admin Console for users, escalation groups, organization, AI, mail, security, session, and role configuration
- PostgreSQL persistence for users, salted scrypt password hashes, escalation groups, settings, and audit events
- Demo data when mail or AI services have not yet been configured

In the combined Vercel Services deployment, the browser app is mounted at
`/app`, with the signed-in inbox at `/app/inbox`. The repository's existing
MCP/OAuth gateway continues to own `/mcp`, `/.well-known/...`, and
`/oauth/consent`, so direct users and ChatGPT can use the same domain without
sharing session or routing logic.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and provide the required values.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Required production environment variables

Set secrets in Vercel Project Settings, not in committed files.

| Area | Variables |
| --- | --- |
| Identity | `AUTH_SECRET`, `DATABASE_URL`, `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD` |
| Identity options | `DATABASE_SSL`, `ENABLE_DEMO_LOGIN`, `APP_ACCESS_PASSWORD` (legacy fallback) |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Incoming mail | `IMAP_HOST`, `IMAP_PORT`, `IMAP_SECURE`, `IMAP_USER`, `IMAP_PASSWORD` |
| Outgoing mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| Optional | `MAIL_ARCHIVE_FOLDER` |

Generate `AUTH_SECRET` with a cryptographically secure password generator. Use an app password or provider-approved token for IMAP/SMTP when the mail provider requires it.

`ADMIN_INITIAL_PASSWORD` seeds Bernie as the first Super Admin only when no account with the configured email exists. Remove it after the initial account has been created. Keep `ENABLE_DEMO_LOGIN=false` in production; Vercel preview deployments enable the clearly labeled demo experience automatically.

Without `DATABASE_URL`, the Admin Console runs in simulation mode. User, escalation-group, and settings workflows remain fully interactive, but changes are not durable across server instances.

## Security model

- OpenAI, database, IMAP, and SMTP credentials are imported only in server modules.
- The browser receives service readiness booleans, never secret values.
- Every privileged route handler re-verifies the signed session and role; Proxy redirects are only an optimistic first check.
- Admins cannot manage Super Admin accounts or assign privileged administrator roles.
- Users cannot change or delete their own role or access status.
- Passwords are salted and hashed with Node.js scrypt before storage.
- Email bodies are treated as untrusted data in the OpenAI prompt.
- OpenAI actions are assistive only; no AI-generated reply is sent automatically.
- The production domain should not be promoted until console authentication is configured.

## Verification

```bash
npm run typecheck
npm run build
```

## Deployment

The project is linked to the existing Vercel project `ai-mail`. Deploy to preview first, verify the full UI and APIs, then promote the validated deployment to production so `ai-mail.r3alm.com` remains stable during testing.
