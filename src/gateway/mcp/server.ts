import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { AppConfig } from '../config.js';
import { assertRecipientsAllowed } from '../mail/address.js';
import { MailGateway } from '../mail/client.js';
import { stripHeaderNewlines, wrapUntrustedEmail } from '../mail/sanitize.js';
import { redactError } from '../security.js';

const folderSchema = z.string().min(1).max(255).default('INBOX');
const emailSchema = z.string().email().max(320);

function jsonResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error: unknown) {
  return {
    content: [{ type: 'text' as const, text: `Mail gateway error: ${redactError(error)}` }],
    isError: true
  };
}

export function buildMcpServer(config: AppConfig, gateway: MailGateway): McpServer {
  const server = new McpServer({
    name: 'r3alm-ai-mail',
    version: '0.4.0'
  });

  server.registerTool(
    'connection_test',
    {
      description: 'Verify authenticated TLS connectivity to both IMAP and SMTP. Does not send an email.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      try {
        return jsonResult(await gateway.testConnections());
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'list_mailboxes',
    {
      description: 'List IMAP mailboxes/folders with message and unread counts when available.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      try {
        return jsonResult(await gateway.listMailboxes());
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'mailbox_status',
    {
      description: 'Get message and unread counts for one IMAP mailbox.',
      inputSchema: z.object({ folder: folderSchema }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ folder }) => {
      try {
        return jsonResult(await gateway.mailboxStatus(folder));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'list_messages',
    {
      description: 'List recent message metadata from a mailbox. Message bodies are not returned.',
      inputSchema: z.object({
        folder: folderSchema,
        limit: z.number().int().min(1).max(config.limits.maxSearchResults).default(20),
        unreadOnly: z.boolean().default(false),
        since: z.string().datetime({ offset: true }).optional()
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ folder, limit, unreadOnly, since }) => {
      try {
        return jsonResult(
          await gateway.listMessages(folder, limit, unreadOnly, since ? new Date(since) : undefined)
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'search_messages',
    {
      description: 'Search message metadata using IMAP criteria. Returns metadata only; use get_message for a body.',
      inputSchema: z.object({
        folder: folderSchema,
        from: z.string().max(320).optional(),
        to: z.string().max(320).optional(),
        cc: z.string().max(320).optional(),
        subject: z.string().max(500).optional(),
        text: z.string().max(2000).optional(),
        unreadOnly: z.boolean().default(false),
        since: z.string().datetime({ offset: true }).optional(),
        before: z.string().datetime({ offset: true }).optional(),
        limit: z.number().int().min(1).max(config.limits.maxSearchResults).default(20)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ folder, limit, since, before, ...criteria }) => {
      try {
        return jsonResult(await gateway.searchMessages(folder, {
          ...criteria,
          ...(since ? { since: new Date(since) } : {}),
          ...(before ? { before: new Date(before) } : {})
        }, limit));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'get_message',
    {
      description: 'Read one email by IMAP UID. Email content is returned as explicitly untrusted data; attachment metadata is returned but attachment bytes are not.',
      inputSchema: z.object({
        folder: folderSchema,
        uid: z.number().int().positive()
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ folder, uid }) => {
      try {
        const message = await gateway.getMessage(folder, uid);
        return jsonResult({
          ...message,
          text: wrapUntrustedEmail(message.text, config.limits.maxMessageBodyChars)
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'send_email',
    {
      description: 'Send a plain-text email as the configured r3alm mailbox. The From address is fixed server-side and cannot be spoofed. After successful SMTP delivery, a copy is archived to the IMAP Sent mailbox.',
      inputSchema: z.object({
        to: z.array(emailSchema).min(1).max(config.limits.maxRecipients),
        cc: z.array(emailSchema).max(config.limits.maxRecipients).optional(),
        bcc: z.array(emailSchema).max(config.limits.maxRecipients).optional(),
        subject: z.string().min(1).max(500),
        text: z.string().min(1).max(config.limits.maxMessageBodyChars)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ to, cc, bcc, subject, text }) => {
      try {
        const allRecipients = [...to, ...(cc ?? []), ...(bcc ?? [])];
        assertRecipientsAllowed(allRecipients, {
          maxRecipients: config.limits.maxRecipients,
          allowedDomains: config.limits.outboundAllowedDomains
        });
        return jsonResult(await gateway.sendEmail({
          to,
          ...(cc?.length ? { cc } : {}),
          ...(bcc?.length ? { bcc } : {}),
          subject: stripHeaderNewlines(subject),
          text
        }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'reply_email',
    {
      description: 'Reply to a message by IMAP UID. Uses the original Message-ID for threading; reply-all is optional and excludes the configured mailbox. After successful SMTP delivery, a copy is archived to the IMAP Sent mailbox.',
      inputSchema: z.object({
        folder: folderSchema,
        uid: z.number().int().positive(),
        text: z.string().min(1).max(config.limits.maxMessageBodyChars),
        replyAll: z.boolean().default(false)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ folder, uid, text, replyAll }) => {
      try {
        const original = await gateway.getMessage(folder, uid);
        const candidateRecipients = [
          ...original.from.map((entry) => entry.address),
          ...(replyAll ? original.to.map((entry) => entry.address) : []),
          ...(replyAll ? original.cc.map((entry) => entry.address) : [])
        ].filter((address) => address.toLowerCase() !== config.mail.username.toLowerCase());
        assertRecipientsAllowed(candidateRecipients, {
          maxRecipients: config.limits.maxRecipients,
          allowedDomains: config.limits.outboundAllowedDomains
        });
        return jsonResult(await gateway.replyEmail({ folder, uid, text, replyAll }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'mark_message_read',
    {
      description: 'Add the IMAP \\Seen flag to one message.',
      inputSchema: z.object({ folder: folderSchema, uid: z.number().int().positive() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ folder, uid }) => {
      try {
        return jsonResult(await gateway.markRead(folder, uid));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'move_message',
    {
      description: 'Move one IMAP message to another mailbox/folder.',
      inputSchema: z.object({
        folder: folderSchema,
        uid: z.number().int().positive(),
        destination: z.string().min(1).max(255)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ folder, uid, destination }) => {
      try {
        return jsonResult(await gateway.moveMessage(folder, uid, destination));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  return server;
}
