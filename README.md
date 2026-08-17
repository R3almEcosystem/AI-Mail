# r3alm AI Mail

Secure remote MCP gateway that gives an authorized AI client controlled access to the `admin@r3alm.com` mailbox over authenticated IMAP and SMTP.

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
5. The MCP Express host/origin guard is enabled; configure `MCP_ALLOWED_HOSTS` for the deployed hostname.
6. Inbound email content is returned inside an explicit untrusted-data boundary to reduce prompt-injection risk.
7. Nodemailer file/URL access is disabled; no arbitrary attachment exfiltration tool exists in v0.1.
8. The From address is fixed server-side to `MAIL_USERNAME`.
9. Optional `OUTBOUND_ALLOWED_DOMAINS` can restrict recipient domains.
10. Raw messages over the configured size ceiling are rejected before MIME parsing.

## Local setup

Requirements: Node.js 20+ (Node 22 recommended).

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

## Production deployment

Deploy behind a public HTTPS hostname such as `mail-ai.r3alm.com`, then set:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
MCP_ALLOWED_HOSTS=mail-ai.r3alm.com
MAIL_USERNAME=admin@r3alm.com
MAIL_PASSWORD=<deployment secret>
MCP_API_TOKEN=<deployment secret>
```

Do **not** expose port 3000 directly to the internet without HTTPS termination and access controls.

### Docker

```bash
docker build -t r3alm-ai-mail .
docker run --rm -p 3000:3000 --env-file .env r3alm-ai-mail
```

## ChatGPT integration

The endpoint is a remote Streamable HTTP MCP server at:

```text
https://YOUR-HOST/mcp
```

For production ChatGPT use, the recommended next authentication step is to place this MCP resource server behind an OAuth/OIDC provider or an approved secure MCP tunnel. The static bearer token implemented here is intended for controlled initial testing and MCP clients that can set an Authorization header.

As of August 2026, OpenAI documents full custom-MCP write/modify actions for ChatGPT Business and Enterprise/Edu workspaces; Pro custom MCP connections are limited to read/fetch permissions. The server itself exposes both read and write tools, so SMTP actions become available when the ChatGPT workspace supports full MCP (or when the same remote MCP server is used through an API client that supports those tools).

When the ChatGPT account/workspace supports the required custom-app permissions, add the remote MCP endpoint in ChatGPT's developer/custom-app settings, review the discovered tools, and keep write tools subject to user confirmation/workspace policy.

## Configuration reference

| Variable | Required | Default/Example | Purpose |
|---|---|---|---|
| `MAIL_USERNAME` | Yes | `admin@r3alm.com` | Authenticated mailbox and fixed From address |
| `MAIL_PASSWORD` | Yes | secret | IMAP/SMTP password |
| `IMAP_HOST` | Yes | `mail.r3alm.com` | IMAP host |
| `IMAP_PORT` | Yes | `993` | IMAP implicit TLS port |
| `IMAP_SECURE` | Yes | `true` | Implicit TLS |
| `SMTP_HOST` | Yes | `mail.r3alm.com` | SMTP host |
| `SMTP_PORT` | Yes | `465` | SMTP implicit TLS port |
| `SMTP_SECURE` | Yes | `true` | Implicit TLS |
| `MCP_API_TOKEN` | Yes | secret | Bearer token protecting `/mcp` |
| `MCP_ALLOWED_HOSTS` | Yes for public bind | deployed hostname | DNS-rebinding host allowlist |
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

CI runs those checks for pull requests and pushes to `main`.

## Roadmap

- OAuth/OIDC resource-server integration for production ChatGPT app authentication.
- Secure deployment and DNS/TLS configuration.
- Auditable outbound-message event logging without storing message bodies.
- Optional scoped attachment retrieval with strict content/size policies.
- Per-user authorization scopes (`mail:read`, `mail:send`, `mail:manage`).
