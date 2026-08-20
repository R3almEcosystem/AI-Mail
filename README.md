# r3alm AI Mail

Secure remote MCP gateway that gives an authorized AI client controlled access to the `admin@r3alm.com` mailbox over authenticated IMAP and SMTP.

## Dual access on one domain

Production uses two Vercel projects built from this single repository. The
public `ai-mail` Express project keeps the connector and proxies the direct
browser route to the independently built `ai-mail-web` Next.js project:

| Route | Audience | Service |
|---|---|---|
| `/app` | Direct browser users | Next.js landing page, login, inbox, alerts, groups, and Admin Console |
| `/mcp` | ChatGPT and other authorized MCP clients | Existing authenticated MCP mail gateway |
| `/.well-known/oauth-protected-resource*` | ChatGPT OAuth discovery | Existing OAuth resource metadata |
| `/oauth/consent` | ChatGPT OAuth approval | Existing passwordless consent flow |
| `/healthz` | Operations | Gateway health check |

The gateway remains the catch-all application, preserving every connector URL.
Root-level Vercel rewrites proxy only `/app` to the companion web project. A
direct visit to the domain root is sent to `/app` unless a pending OAuth
authorization is being resumed in that browser.

## Current r3alm mail settings

| Function | Host | Port | Security | Authentication |
|---|---|---:|---|---|
| IMAP | `mail.r3alm.com` | 993 | Implicit SSL/TLS | Required |
| SMTP | `mail.r3alm.com` | 465 | Implicit SSL/TLS | Required |
| Mailbox | `admin@r3alm.com` | — | — | Password via secret only |

**No mailbox password is stored in this repository.** `MAIL_PASSWORD` remains blank in `.env.example` until a deployment secret is configured.

## MCP tools

### Read-only

- `connection_test` — verifies IMAP and SMTP authentication/TLS without sending mail.
- `list_mailboxes` — lists folders and counts.
- `mailbox_status` — folder counts/status.
- `list_messages` — recent message metadata.
- `search_messages` — IMAP search across sender, recipient, subject, text, read state, and dates.
- `get_message` — parses one message and returns plain-text body plus attachment metadata. Email body is explicitly marked as untrusted input.

### Write actions

- `send_email` — sends plain-text email from the fixed configured mailbox.
- `reply_email` — threaded reply/reply-all using the original Message-ID.
- `mark_message_read` — adds `\\Seen`.
- `move_message` — moves a message to another IMAP folder.

The initial release deliberately does **not** expose arbitrary attachment downloads/sends, raw HTML sending, mailbox deletion, or message deletion.

## Security model

1. IMAP 993 and SMTP 465 use TLS from connection start.
2. Server certificates are verified; TLS 1.2+ is required.
3. Mail credentials stay in environment/secrets, never Git.
4. `/mcp` requires `Authorization: Bearer <MCP_API_TOKEN>`.
5. The MCP Express host/origin guard is enabled. On Vercel, the active deployment, branch, and production hostnames are automatically added when Vercel System Environment Variables are exposed.
6. Inbound email content is returned inside an explicit untrusted-data boundary to reduce prompt-injection risk.
7. Nodemailer file/URL access is disabled; no arbitrary attachment exfiltration tool exists in v0.1.
8. The From address is fixed server-side to `MAIL_USERNAME`.
9. Optional `OUTBOUND_ALLOWED_DOMAINS` can restrict recipient domains.
10. Raw messages over the configured size ceiling are rejected before MIME parsing.

## Local setup

Requirements: Node.js 20+ (Node 22 or 24 recommended).

```bash
cp .env.example .env
npm install
```

Set the two secrets in `.env`:

```dotenv
MAIL_PASSWORD=<mailbox password>
MCP_API_TOKEN=<at least 32 random characters>
```

A convenient token generator:

```bash
openssl rand -hex 32
```

Then run:

```bash
npm run dev
```

Health endpoint:

```bash
curl http://127.0.0.1:3000/healthz
```

List MCP tools locally:

```bash
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Authorization: Bearer YOUR_MCP_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Vercel deployment — recommended

The production `ai-mail` project remains an Express application. `src/index.ts` owns the MCP/OAuth gateway, and the root `vercel.json` proxies only `/app` to the independently deployed `apps/web` Next.js project.

### 1. Import the GitHub repository

Import:

```text
R3almEcosystem/AI-Mail
```

Use the feature branch `agent/initial-mail-gateway` for the first Preview deployment, then merge PR #1 and use `main` for Production after validation.

Keep the existing `ai-mail` project on the **Express** Framework Preset. Deploy `apps/web` to the companion `ai-mail-web` Next.js project; do not set a static output directory.

### 2. Add Vercel environment variables

In **Project → Settings → Environment Variables**, add these values. At minimum, set the three secrets/identity values shown first.

```dotenv
MAIL_USERNAME=admin@r3alm.com
MAIL_PASSWORD=<secret>
MCP_API_TOKEN=<32+ character secret>

IMAP_HOST=mail.r3alm.com
IMAP_PORT=993
IMAP_SECURE=true
SMTP_HOST=mail.r3alm.com
SMTP_PORT=465
SMTP_SECURE=true

MAX_MESSAGE_BODY_CHARS=50000
MAX_RAW_MESSAGE_BYTES=10000000
MAX_SEARCH_RESULTS=50
MAX_RECIPIENTS=20
OUTBOUND_ALLOWED_DOMAINS=
```

`HOST` and `PORT` are not required by Vercel's listener; the application defaults remain for local/Docker use.

Mark `MAIL_PASSWORD` and `MCP_API_TOKEN` as sensitive secrets. Apply them to **Preview** while testing and **Production** before the production deployment.

### 3. Expose Vercel System Environment Variables

Enable **Automatically expose System Environment Variables** in Vercel's Environment Variables settings. The application will then add these Vercel-provided values to its DNS-rebinding allowlist when present:

```text
VERCEL_URL
VERCEL_BRANCH_URL
VERCEL_PROJECT_PRODUCTION_URL
```

If you do not expose those values, set `MCP_ALLOWED_HOSTS` manually to the exact deployment/custom hostname(s).

For the eventual stable endpoint, add a custom domain such as:

```text
mail-ai.r3alm.com
```

Then either rely on `VERCEL_PROJECT_PRODUCTION_URL` or explicitly add:

```dotenv
MCP_ALLOWED_HOSTS=mail-ai.r3alm.com
```

### 4. Deploy and test health

After Vercel finishes the Preview deployment:

```bash
curl https://YOUR-DEPLOYMENT.vercel.app/healthz
```

Expected response:

```json
{
  "service": "r3alm-ai-mail",
  "status": "ok",
  "version": "0.1.0",
  "runtime": "vercel"
}
```

### 5. Test MCP discovery

```bash
curl -s -X POST https://YOUR-DEPLOYMENT.vercel.app/mcp \
  -H 'Authorization: Bearer YOUR_MCP_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 6. Test the live mailbox connection

This verifies both authenticated IMAP and SMTP/TLS without sending an email:

```bash
curl -s -X POST https://YOUR-DEPLOYMENT.vercel.app/mcp \
  -H 'Authorization: Bearer YOUR_MCP_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"connection_test","arguments":{}}}'
```

Do not test `send_email` until `connection_test` succeeds.

### Vercel networking notes

- SMTP port **465** is suitable for this deployment; port 25 should not be used on Vercel.
- IMAP and SMTP operations are awaited before the Function returns, so the sockets are closed inside the invocation rather than left as background work.
- If `mail.r3alm.com` later restricts access by source IP, ordinary Vercel outbound addresses are dynamic. Use Vercel Static IPs/Secure Compute or update the mail-server firewall policy before enabling such an allowlist.

## Docker deployment

The same repository still supports standalone deployment:

```bash
docker build -t r3alm-ai-mail .
docker run --rm -p 3000:3000 --env-file .env r3alm-ai-mail
```

## ChatGPT integration

The remote Streamable HTTP MCP endpoint is:

```text
https://YOUR-HOST/mcp
```

For production ChatGPT use, the recommended next authentication step is to place this MCP resource server behind an OAuth/OIDC provider or an approved secure MCP tunnel. The static bearer token implemented here is intended for controlled initial testing and MCP clients that can set an Authorization header.

The server itself exposes both read and write tools. Which tools ChatGPT can invoke depends on the custom-app/MCP permissions available in the ChatGPT workspace being used.

## Configuration reference

| Variable | Required | Default/Example | Purpose |
|---|---|---|---|
| `MAIL_USERNAME` | Yes | `admin@r3alm.com` | Authenticated mailbox and fixed From address |
| `MAIL_PASSWORD` | Yes | secret | IMAP/SMTP password |
| `IMAP_HOST` | No | `mail.r3alm.com` | IMAP host |
| `IMAP_PORT` | No | `993` | IMAP implicit TLS port |
| `IMAP_SECURE` | No | `true` | Implicit TLS |
| `SMTP_HOST` | No | `mail.r3alm.com` | SMTP host |
| `SMTP_PORT` | No | `465` | SMTP implicit TLS port |
| `SMTP_SECURE` | No | `true` | Implicit TLS |
| `MCP_API_TOKEN` | Yes | secret | Bearer token protecting `/mcp` |
| `MCP_ALLOWED_HOSTS` | No on Vercel with system vars | custom hostname | Additional DNS-rebinding host allowlist |
| `MAX_MESSAGE_BODY_CHARS` | No | `50000` | Body/tool size limit |
| `MAX_RAW_MESSAGE_BYTES` | No | `10000000` | Reject raw messages larger than this before MIME parsing |
| `MAX_SEARCH_RESULTS` | No | `50` | Hard cap on returned search results |
| `MAX_RECIPIENTS` | No | `20` | Total recipient hard cap |
| `OUTBOUND_ALLOWED_DOMAINS` | No | empty | Optional egress domain allowlist |

## Development checks

```bash
npm run typecheck
npm test
npm run build
```

CI runs those checks for pull requests and pushes to `main`. The repository's current GitHub Actions runner is blocked by the GitHub account billing lock, so keep PR #1 draft until dependency-aware validation can execute or the Vercel Preview build provides equivalent build feedback.

## Roadmap

- OAuth/OIDC resource-server integration for production ChatGPT app authentication.
- Auditable outbound-message event logging without storing message bodies.
- Optional scoped attachment retrieval with strict content/size policies.
- Per-user authorization scopes (`mail:read`, `mail:send`, `mail:manage`).
