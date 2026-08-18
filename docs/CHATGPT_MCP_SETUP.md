# ChatGPT MCP Setup — r3alm AI-Mail

## Production endpoint

- MCP endpoint: `https://ai-mail.r3alm.com/mcp`
- Health endpoint: `https://ai-mail.r3alm.com/healthz`
- Server name: `r3alm-ai-mail`
- Current version: `0.2.0`

The production endpoint is protected by the `MCP_API_TOKEN` configured in Vercel. Do not commit or paste that token into source control.

## Pre-registration checks

Before registering the MCP server in ChatGPT, verify:

1. `GET /healthz` returns `status: ok`.
2. MCP `tools/list` succeeds with the configured bearer credential.
3. `connection_test` returns both `imap: ok` and `smtp: ok`.
4. Vercel Deployment Protection does not block the production endpoint for the intended MCP client, or an approved automation bypass is configured.

## ChatGPT custom-app registration

OpenAI currently supports custom MCP apps through ChatGPT Developer Mode.

1. Enable Developer Mode for the eligible ChatGPT account/workspace.
2. Open **Settings / Workspace Settings → Apps → Create**.
3. Create a custom app named **r3alm AI-Mail**.
4. Set the remote MCP endpoint to:

   `https://ai-mail.r3alm.com/mcp`

5. Select the authentication mechanism offered by the ChatGPT app-creation flow.
   - If the UI supports a bearer/API-key or custom-header credential, use the existing `MCP_API_TOKEN` as `Authorization: Bearer <token>`.
   - If the workspace requires OAuth/OIDC for custom MCP authentication, add OAuth/OIDC to AI-Mail before publishing rather than removing gateway authentication.
6. Run **Scan Tools**.
7. Confirm the ten tools listed below are discovered.
8. Create the app as a draft and test it in a new chat before publishing.

## Expected MCP tools

### Read-only

- `connection_test`
- `list_mailboxes`
- `mailbox_status`
- `list_messages`
- `search_messages`
- `get_message`

### Write / modify

- `send_email`
- `reply_email`
- `mark_message_read`
- `move_message`

`send_email` and `reply_email` deliver over authenticated SMTP and then best-effort archive an RFC 822 copy into the server-designated IMAP `\\Sent` mailbox.

## Recommended action permissions

For initial testing:

- Allow read-only tools without additional approval where workspace policy permits.
- Require confirmation for `send_email`, `reply_email`, `mark_message_read`, and `move_message`.
- Do not broaden recipient-domain permissions until normal mail workflows have been verified.

## ChatGPT availability note

OpenAI currently documents full custom-MCP write/modify support for ChatGPT Business and Enterprise/Edu workspaces. Pro users can connect custom MCPs with read/fetch permissions in Developer Mode, but full write/modify support is not currently available there.

## OpenAI API alternative

The OpenAI Responses API supports remote MCP servers and can send optional HTTP headers to the MCP endpoint. This provides a programmatic route for using the same AI-Mail server with an `Authorization` header and explicit tool approval controls.

Keep both credentials server-side:

- `OPENAI_API_KEY`
- `MCP_API_TOKEN`

Never expose either credential in browser/client code.

## Production address

Use the stable custom domain for all clients:

`https://ai-mail.r3alm.com/mcp`

Avoid pinning clients to ephemeral Vercel deployment URLs.
