# Security Policy

## Secrets

Never commit mailbox passwords, MCP bearer tokens, TLS private keys, or deployment credentials. The repository ignores `.env` and all `.env.*` files except `.env.example`.

`MAIL_PASSWORD` and `MCP_API_TOKEN` must be injected by the deployment environment or a secrets manager.

## Transport security

The default r3alm configuration uses implicit TLS for IMAP (993) and SMTP (465), certificate verification is enabled, and TLS 1.2 or newer is required. Do not disable certificate verification to work around server configuration problems.

## Email-content trust boundary

Inbound email is hostile/untrusted input. `get_message` wraps message text with an explicit untrusted-data boundary and does not expose attachment bytes. The gateway never interprets email text as executable instructions.

## Outbound controls

- The From address is fixed to the configured mailbox.
- SMTP messages are plain text only in the initial release.
- Local file access and URL-based content loading are disabled in Nodemailer.
- Recipient count and optional recipient-domain allowlists are enforced server-side.
- No generic file attachment sending is exposed in the initial release.

## MCP authentication

The initial gateway uses a long static bearer token at the `/mcp` boundary. This is an MVP deployment control, not a substitute for an organizational OAuth/OIDC authorization server. Put the service behind HTTPS and migrate to OAuth/OIDC or an approved secure tunnel before broad multi-user deployment.

## Vulnerability reporting

Report security issues privately to the r3alm engineering/security team. Do not publish credentials, mailbox contents, or exploit details in a public GitHub issue.
