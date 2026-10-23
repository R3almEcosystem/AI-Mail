# ASSIST Mail · Vite/React Portal

This is the new frontend architecture requested for ASSIST Mail.

## Current status
The Vite React shell is committed independently from the existing Next.js server. It does **not** yet implement authenticated inbox/admin operations. The existing Next.js deployment must remain available until API route handlers for IMAP, OAuth, MCP, user sessions, settings and delivery are moved behind a standalone authenticated server API.

## Build
Run `npm install` and `npm run build` from `portal/`.

## Deployment
Create a **separate Vercel project** using Framework **Vite**, Root Directory **portal**, Build `npm run build`, Output `dist`. Do not change the existing `ai-mail` project root to `portal` until all protected functionality is migrated and acceptance-tested.

## Preservation
No migrations affecting mail users, existing IMAP identities, mailbox settings, or stored mail credentials occur as part of this scaffold. The authenticated server endpoints must never be served as static Vite assets. The owner `admin@sovsi.xyz` remains managed in Supabase identity and authorized application records.
