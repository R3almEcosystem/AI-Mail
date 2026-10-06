import { ImapFlow, type SearchObject } from 'imapflow';
import nodemailer from 'nodemailer';
import PostalMime from 'postal-mime';
import { inspectAttachments, attachmentPolicyFromEnv, type AttachmentInspection, type AttachmentPolicy } from '../security/attachment-scan.js';
import { assessEmailSecurity, assertOutboundEmailSecurity, type SecurityAssessment } from '../security/email-security.js';
import { assertRecipientsAllowed, envelopeAddresses, dedupeAddresses } from './address.js';
import { normalizeMessageId, subjectForReply, stripHeaderNewlines, clampText } from './sanitize.js';
import { assertMessageIdentity, mailTagFlag, type MailServiceConfig, type MailAction, type MailTag } from './policy.js';

export type MessageSummary = {
  uid: number; subject: string; date?: string;
  from: Array<{ name?: string; address: string }>;
  to: Array<{ name?: string; address: string }>; flags: string[];
};
export type ParsedMessage = MessageSummary & {
  security: SecurityAssessment;
  attachmentInspection: AttachmentInspection;
  cc: Array<{ name?: string; address: string }>;
  messageId?: string; inReplyTo?: string; references: string[]; text: string;
  safeHtmlBody?: string;
  attachments: Array<{ filename?: string; mimeType?: string; disposition?: string; related?: boolean; contentId?: string }>;
};
export type AttachmentSource = {
  filename?: string;
  mimeType?: string;
  disposition?: string;
  related?: boolean;
  contentId?: string;
  content: Uint8Array | ArrayBuffer;
};
export type SearchCriteria = { from?: string; to?: string; cc?: string; subject?: string; text?: string; unreadOnly?: boolean; since?: Date; before?: Date };
type SendInput = { to: string[]; cc?: string[]; bcc?: string[]; subject: string; text: string; inReplyTo?: string; references?: string[] };
type SentCopyStatus = { stored: boolean; folder?: string; uid?: number; warning?: string };
const tlsOptions = (host: string) => ({ rejectUnauthorized: true, minVersion: 'TLSv1.2' as const, servername: host });
const MAX_SAFE_HTML_CHARS = 250000;

function sanitizeEmailCss(css: string): string {
  return css
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/url\s*\([^)]*\)/gi, 'none')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;}]*/gi, '');
}

function sanitizeEmailHtmlFragment(rawHtml: string): string {
  let html = rawHtml.slice(0, MAX_SAFE_HTML_CHARS);
  html = html.replace(/<!--[^]*?-->/g, '');
  html = html.replace(/<(script|iframe|object|embed|form|input|button|textarea|select|option|meta|base|link|video|audio|source|track|svg|math)\b[^>]*>[^]*?<\/\1\s*>/gi, '');
  html = html.replace(/<(script|iframe|object|embed|form|input|button|textarea|select|option|meta|base|link|video|audio|source|track|svg|math)\b[^>]*\/?\s*>/gi, '');
  html = html.replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/\s+(href|src|srcset|action|formaction|poster|background|ping)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/\s+style\s*=\s*(["'])([^]*?)\1/gi, (_match, quote: string, css: string) => ` style=${quote}${sanitizeEmailCss(css)}${quote}`);
  html = html.replace(/<style\b[^>]*>([^]*?)<\/style\s*>/gi, (_match, css: string) => `<style>${sanitizeEmailCss(css)}</style>`);
  return html;
}

function buildSafeEmailHtml(rawHtml: string): string | undefined {
  if (!rawHtml.trim()) return undefined;
  const fragment = sanitizeEmailHtmlFragment(rawHtml);
  const csp = "default-src 'none'; script-src 'none'; connect-src 'none'; frame-src 'none'; child-src 'none'; object-src 'none'; media-src 'none'; font-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none';";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><style>html{background:#fff;color:#28364a;font-family:Arial,Helvetica,sans-serif}body{margin:0;padding:20px;overflow-wrap:anywhere;line-height:1.55}img{max-width:100%;height:auto}table{max-width:100%}a{color:#315fa9;text-decoration:underline;pointer-events:none}</style></head><body>${fragment}</body></html>`;
}

/** The single transport implementation used by browser handlers and MCP tools. */
export class MailGateway {
  constructor(private readonly config: MailServiceConfig) {}
  private createImapClient(): ImapFlow {
    if (!this.config.imap.host || !this.config.mail.username || !this.config.mail.password) throw new Error('IMAP is not configured');
    return new ImapFlow({
      ...this.config.imap, auth: { user: this.config.mail.username, pass: this.config.mail.password },
      ...(this.config.imap.secure ? {} : { doSTARTTLS: true }),
      tls: tlsOptions(this.config.imap.host), logger: false,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000,
    });
  }
  private smtpTransport() {
    const { smtp, mail } = this.config;
    const user = smtp.username ?? mail.username; const pass = smtp.password ?? mail.password;
    if (!smtp.host || !user || !pass) throw new Error('SMTP is not configured');
    return nodemailer.createTransport({
      host: smtp.host, port: smtp.port, secure: smtp.secure, requireTLS: !smtp.secure,
      auth: { user, pass }, tls: tlsOptions(smtp.host),
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000,
      disableFileAccess: true, disableUrlAccess: true,
    });
  }
  private async withImap<T>(operation: (client: ImapFlow) => Promise<T>, timeoutMs?: number): Promise<T> {
    const client = this.createImapClient(); let connected = false;
    const timer = timeoutMs
      ? setTimeout(() => client.close(), timeoutMs)
      : null;
    try { await client.connect(); connected = true; return await operation(client); }
    finally {
      if (timer) clearTimeout(timer);
      if (connected) await client.logout().catch(() => client.close());
      else client.close();
    }
  }
  private async withMailbox<T>(folder: string, operation: (client: ImapFlow) => Promise<T>): Promise<T> {
    assertMessageIdentity(folder);
    return this.withImap(async client => {
      const lock = await client.getMailboxLock(folder);
      try { return await operation(client); } finally { lock.release(); }
    });
  }
  async testImap(): Promise<{ imap: 'ok' }> {
    await this.withImap(async () => undefined);
    return { imap: 'ok' };
  }
  async testSmtp(): Promise<{ smtp: 'ok' }> {
    await this.smtpTransport().verify();
    return { smtp: 'ok' };
  }
  async testConnections(): Promise<{ imap: 'ok'; smtp: 'ok' }> {
    await this.testImap();
    await this.testSmtp();
    return { imap: 'ok', smtp: 'ok' };
  }
  async listMailboxes(): Promise<Array<{ path: string; specialUse?: string; messages?: number; unseen?: number }>> {
    return this.withImap(async client => (await client.list({ statusQuery: { messages: true, unseen: true } })).map(box => ({
      path: box.path, ...(box.specialUse ? { specialUse: box.specialUse } : {}),
      ...(box.status?.messages !== undefined ? { messages: box.status.messages } : {}),
      ...(box.status?.unseen !== undefined ? { unseen: box.status.unseen } : {}),
    })));
  }
  async mailboxStatus(folder: string) {
    assertMessageIdentity(folder);
    return this.withImap(async client => {
      const status = await client.status(folder, { messages: true, unseen: true, uidNext: true, uidValidity: true });
      return { path: folder, messages: status.messages ?? 0, unseen: status.unseen ?? 0, uidNext: status.uidNext ?? null, uidValidity: status.uidValidity?.toString() ?? null };
    });
  }

  async listRecentMessagesByFolders(
    folders: string[],
    limit: number,
  ): Promise<Array<{ folder: string; messages: MessageSummary[]; failed: boolean }>> {
    if (!Array.isArray(folders) || !folders.length || folders.length > 10) throw new Error('Invalid mailbox batch');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.config.limits.maxSearchResults) throw new Error('Invalid search limit');
    folders.forEach(folder => assertMessageIdentity(folder));

    return this.withImap(async client => {
      const results: Array<{ folder: string; messages: MessageSummary[]; failed: boolean }> = [];
      for (const folder of folders) {
        let lock: Awaited<ReturnType<ImapFlow['getMailboxLock']>> | null = null;
        try {
          lock = await client.getMailboxLock(folder, { readOnly: true });
          const exists = client.mailbox && typeof client.mailbox.exists === 'number' ? client.mailbox.exists : 0;
          if (!exists) {
            results.push({ folder, messages: [], failed: false });
            continue;
          }

          const range = exists > limit ? `*:-${limit}` : '1:*';
          const messages = await client.fetchAll(range, {
            uid: true,
            envelope: true,
            flags: true,
            internalDate: true,
          });
          results.push({
            folder,
            messages: messages.map(message => this.toSummary(message)).sort((a, b) => b.uid - a.uid),
            failed: false,
          });
        } catch {
          results.push({ folder, messages: [], failed: true });
        } finally {
          lock?.release();
        }
      }
      return results;
    }, 25_000);
  }

  async listMessagesPage(folder: string, limit: number, unreadOnly: boolean, since?: Date, beforeUid?: number): Promise<{ messages: MessageSummary[]; hasMore: boolean }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.config.limits.maxSearchResults) throw new Error('Invalid search limit');
    if (beforeUid !== undefined && (!Number.isSafeInteger(beforeUid) || beforeUid <= 1)) return { messages: [], hasMore: false };

    return this.withMailbox(folder, async client => {
      const query: SearchObject = {};
      if (unreadOnly) query.seen = false;
      if (since) query.since = since;
      if (beforeUid !== undefined) query.uid = `1:${beforeUid - 1}`;
      if (!Object.keys(query).length) query.all = true;

      const found = await client.search(query, { uid: true });
      const uids = Array.isArray(found) ? [...found].sort((a, b) => a - b) : [];
      const selected = uids.slice(-limit);
      if (!selected.length) return { messages: [], hasMore: false };

      const messages = await client.fetchAll(selected, { envelope: true, flags: true, internalDate: true }, { uid: true });
      return {
        messages: messages.map(message => this.toSummary(message)).sort((a, b) => b.uid - a.uid),
        hasMore: uids.length > selected.length,
      };
    });
  }

  async listMessages(folder: string, limit: number, unreadOnly: boolean, since?: Date): Promise<MessageSummary[]> {
    return (await this.listMessagesPage(folder, limit, unreadOnly, since)).messages;
  }
  async searchMessages(folder: string, criteria: SearchCriteria, limit: number): Promise<MessageSummary[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.config.limits.maxSearchResults) throw new Error('Invalid search limit');
    return this.withMailbox(folder, async client => {
      const query: SearchObject = {};
      if (criteria.from) query.from = criteria.from;
      if (criteria.to) query.to = criteria.to;
      if (criteria.cc) query.cc = criteria.cc;
      if (criteria.subject) query.subject = criteria.subject;
      if (criteria.text) query.text = criteria.text;
      if (criteria.unreadOnly) query.seen = false;
      if (criteria.since) query.since = criteria.since;
      if (criteria.before) query.before = criteria.before;
      if (!Object.keys(query).length) query.all = true;
      const found = await client.search(query, { uid: true });
      const selected = Array.isArray(found) ? found.slice(-limit) : [];
      if (!selected.length) return [];
      const messages = await client.fetchAll(selected, { envelope: true, flags: true, internalDate: true }, { uid: true });
      return messages.map(message => this.toSummary(message)).sort((a, b) => b.uid - a.uid);
    });
  }

  async searchMessageUids(folder: string, criteria: SearchCriteria): Promise<number[]> {
    return this.withMailbox(folder, async client => {
      const query: SearchObject = {};
      if (criteria.from) query.from = criteria.from;
      if (criteria.to) query.to = criteria.to;
      if (criteria.cc) query.cc = criteria.cc;
      if (criteria.subject) query.subject = criteria.subject;
      if (criteria.text) query.text = criteria.text;
      if (criteria.unreadOnly) query.seen = false;
      if (criteria.since) query.since = criteria.since;
      if (criteria.before) query.before = criteria.before;
      if (!Object.keys(query).length) query.all = true;
      const found = await client.search(query, { uid: true });
      return Array.isArray(found) ? [...found].sort((a, b) => b - a) : [];
    });
  }

  async searchMessageUidGroups(folder: string, criteriaList: SearchCriteria[]): Promise<number[][]> {
    if (!Array.isArray(criteriaList) || criteriaList.length > 100) throw new Error('Invalid research search batch');
    return this.withMailbox(folder, async client => {
      const results: number[][] = [];
      for (const criteria of criteriaList) {
        const query: SearchObject = {};
        if (criteria.from) query.from = criteria.from;
        if (criteria.to) query.to = criteria.to;
        if (criteria.cc) query.cc = criteria.cc;
        if (criteria.subject) query.subject = criteria.subject;
        if (criteria.text) query.text = criteria.text;
        if (criteria.unreadOnly) query.seen = false;
        if (criteria.since) query.since = criteria.since;
        if (criteria.before) query.before = criteria.before;
        if (!Object.keys(query).length) query.all = true;
        const found = await client.search(query, { uid: true });
        results.push(Array.isArray(found) ? [...found].sort((a, b) => b - a) : []);
      }
      return results;
    });
  }

  async loadResearchMessages(folder: string, uids: number[], limit = 300): Promise<Array<{
    uid: number;
    subject: string;
    date?: string;
    from: Array<{ name?: string; address: string }>;
    to: Array<{ name?: string; address: string }>;
    cc: Array<{ name?: string; address: string }>;
    text: string;
    security: SecurityAssessment;
    truncated: boolean;
  }>> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid research limit');
    const selected = [...new Set(uids.filter(uid => Number.isSafeInteger(uid) && uid > 0 && uid <= 4294967295))].slice(0, limit);
    if (!selected.length) return [];

    return this.withMailbox(folder, async client => {
      const metadata = await client.fetchAll(selected, { envelope: true, internalDate: true, size: true }, { uid: true });
      const allowed = metadata
        .filter(message => typeof message.size === 'number' && message.size >= 0 && message.size <= this.config.limits.maxRawMessageBytes)
        .map(message => message.uid);
      if (!allowed.length) return [];

      const loaded = await client.fetchAll(allowed, { envelope: true, internalDate: true, source: true }, { uid: true });
      const results: Array<{
        uid: number;
        subject: string;
        date?: string;
        from: Array<{ name?: string; address: string }>;
        to: Array<{ name?: string; address: string }>;
        cc: Array<{ name?: string; address: string }>;
        text: string;
        security: SecurityAssessment;
        truncated: boolean;
      }> = [];

      for (const message of loaded) {
        if (!message.source || message.source.byteLength > this.config.limits.maxRawMessageBytes) continue;
        const parsed = await PostalMime.parse(message.source, { maxNestingDepth: 50 });
        const rawText = parsed.text || '';
        const maxBody = Math.min(this.config.limits.maxMessageBodyChars, 16000);
        const text = clampText(rawText, maxBody);
        const security = assessEmailSecurity({
          direction: folder === 'INBOX.Sent' ? 'outbound' : 'inbound',
          subject: message.envelope?.subject || '',
          text: rawText.slice(0, 50000),
          from: envelopeAddresses(message.envelope?.from)[0]?.address,
          attachments: parsed.attachments.map(attachment => ({
            filename: attachment.filename ?? undefined,
            mimeType: attachment.mimeType,
          })),
        });
        results.push({
          uid: message.uid,
          subject: message.envelope?.subject || '(no subject)',
          ...(message.internalDate instanceof Date ? { date: message.internalDate.toISOString() } : {}),
          from: envelopeAddresses(message.envelope?.from),
          to: envelopeAddresses(message.envelope?.to),
          cc: envelopeAddresses(message.envelope?.cc),
          text,
          security,
          truncated: rawText.length > text.length,
        });
      }

      return results.sort((a, b) => b.uid - a.uid);
    });
  }
  async getMessageWithAttachments(folder: string, uid: number, policy: AttachmentPolicy = attachmentPolicyFromEnv()): Promise<{
    message: ParsedMessage;
    attachmentSources: AttachmentSource[];
    uidValidity: string | null;
  }> {
    assertMessageIdentity(folder, uid);
    const loaded = await this.withMailbox(folder, async client => {
      const metadata = await client.fetchOne(uid, { size: true }, { uid: true });
      if (!metadata) throw new Error('Message not found');
      if (typeof metadata.size !== 'number' || !Number.isSafeInteger(metadata.size) || metadata.size < 0 || metadata.size > this.config.limits.maxRawMessageBytes) throw new Error('Message exceeds the raw-message size limit or its size is unknown');
      const message = await client.fetchOne(uid, { envelope: true, flags: true, internalDate: true, source: true }, { uid: true });
      if (!message || !message.source) throw new Error('Message not found');
      if (message.source.byteLength > this.config.limits.maxRawMessageBytes) throw new Error('Message exceeds the raw-message size limit');
      const parsed = await PostalMime.parse(message.source, { maxNestingDepth: 50 });
      const headers = new Map<string, string>(parsed.headers.map(header => [header.key.toLowerCase(), header.value] as [string, string]));
      const security = assessEmailSecurity({
        direction: folder === 'INBOX.Sent' ? 'outbound' : 'inbound', subject: message.envelope?.subject || '', text: parsed.text || '', html: parsed.html || '',
        from: envelopeAddresses(message.envelope?.from)[0]?.address, replyTo: headers.get('reply-to'),
        attachments: parsed.attachments.map(attachment => ({ filename: attachment.filename ?? undefined, mimeType: attachment.mimeType })),
      });
      const attachmentSources: AttachmentSource[] = parsed.attachments.map(attachment => ({
        ...(attachment.filename ? { filename: attachment.filename } : {}),
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
        ...(attachment.disposition ? { disposition: attachment.disposition } : {}),
        ...(attachment.related !== undefined ? { related: attachment.related } : {}),
        ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
        content: typeof attachment.content === 'string' ? new TextEncoder().encode(attachment.content) : attachment.content,
      }));
      return {
        uidValidity: client.mailbox && client.mailbox.uidValidity ? client.mailbox.uidValidity.toString() : null,
        attachmentBytes: attachmentSources.map(attachment => attachment.content),
        attachmentSources,
        message: {
          security,
          ...this.toSummary(message),
          cc: envelopeAddresses(message.envelope?.cc),
          messageId: normalizeMessageId(parsed.messageId || message.envelope?.messageId),
          inReplyTo: normalizeMessageId(headers.get('in-reply-to')),
          references: (headers.get('references') || '').split(/\s+/).slice(0, 100).map(normalizeMessageId).filter((id): id is string => Boolean(id)),
          text: clampText(parsed.text || '', this.config.limits.maxMessageBodyChars),
          ...(parsed.html ? { safeHtmlBody: buildSafeEmailHtml(parsed.html) } : {}),
          attachments: attachmentSources.map(attachment => ({
            ...(attachment.filename ? { filename: attachment.filename } : {}),
            ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
            ...(attachment.disposition ? { disposition: attachment.disposition } : {}),
            ...(attachment.related !== undefined ? { related: attachment.related } : {}),
            ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
          })),
        },
      };
    });

    // Release the IMAP lock and connection before any third-party inspection or persistence.
    const attachmentInspection = await inspectAttachments(loaded.attachmentBytes, policy);
    return {
      message: { ...loaded.message, attachmentInspection },
      attachmentSources: loaded.attachmentSources,
      uidValidity: loaded.uidValidity,
    };
  }

  async getMessage(folder: string, uid: number): Promise<ParsedMessage> {
    return (await this.getMessageWithAttachments(folder, uid)).message;
  }
  async updateMessage(folder: string, uid: number, action: MailAction, archiveFolder = 'Archive', tag?: MailTag) {
    assertMessageIdentity(folder, uid);
    if (!['read', 'unread', 'flag', 'unflag', 'archive', 'tag', 'untag'].includes(action)) throw new Error('Invalid mailbox action');
    if (action === 'archive') return this.moveMessage(folder, uid, archiveFolder);
    if ((action === 'tag' || action === 'untag') && !tag) throw new Error('A message tag is required');
    return this.withMailbox(folder, async client => {
      const flag = action === 'read' || action === 'unread'
        ? '\\Seen'
        : action === 'flag' || action === 'unflag'
          ? '\\Flagged'
          : mailTagFlag(tag!);
      const add = action === 'read' || action === 'flag' || action === 'tag';
      const result = add
        ? await client.messageFlagsAdd(uid, [flag], { uid: true })
        : await client.messageFlagsRemove(uid, [flag], { uid: true });
      if (result !== true) throw new Error('IMAP did not confirm the message status change');
      const updated = await client.fetchOne(uid, { flags: true }, { uid: true });
      if (!updated) throw new Error('Message status could not be reloaded after the change');
      return {
        uid,
        action,
        ...(tag ? { tag } : {}),
        flags: updated.flags ? [...updated.flags] : [],
      };
    });
  }
  async markRead(folder: string, uid: number): Promise<{ uid: number; read: true }> {
    await this.updateMessage(folder, uid, 'read'); return { uid, read: true };
  }
  async moveMessage(folder: string, uid: number, destination: string): Promise<{ uid: number; destination: string }> {
    assertMessageIdentity(folder, uid); assertMessageIdentity(destination);
    return this.withMailbox(folder, async client => {
      const result = await client.messageMove(uid, destination, { uid: true });
      if (!result) throw new Error('IMAP did not confirm the move');
      return { uid, destination };
    });
  }
  private async archiveSentCopy(input: SendInput, messageId: string, date: Date): Promise<SentCopyStatus> {
    try {
      const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, disableFileAccess: true, disableUrlAccess: true });
      const compiled = await composer.sendMail({ ...input, from: this.config.smtp.from ?? this.config.mail.username, messageId, date });
      const raw = (compiled as unknown as { message?: unknown }).message;
      if (!Buffer.isBuffer(raw)) throw new Error('Invalid Sent copy');
      return await this.withImap(async client => {
        const boxes = await client.list(); const folder = boxes.find(box => box.specialUse === '\\Sent')?.path ?? 'INBOX.Sent';
        const result = await client.append(folder, raw, ['\\Seen'], date);
        if (!result) throw new Error('IMAP did not confirm Sent copy');
        return { stored: true, folder, ...(typeof result.uid === 'number' ? { uid: result.uid } : {}) };
      });
    } catch { return { stored: false, warning: 'SMTP accepted the message, but the Sent copy could not be confirmed. Do not resend solely to retry archival.' }; }
  }
  async sendEmail(input: SendInput) {
    assertRecipientsAllowed([...input.to, ...(input.cc ?? []), ...(input.bcc ?? [])], { maxRecipients: this.config.limits.maxRecipients, allowedDomains: this.config.limits.outboundAllowedDomains });
    const subject = stripHeaderNewlines(input.subject);
    if (!subject || subject.length > 500 || !input.text.trim() || input.text.length > this.config.limits.maxMessageBodyChars) throw new Error('Invalid outgoing message');
    // Shared by browser and MCP send/reply. No transport is opened after a denial.
    assertOutboundEmailSecurity({ direction: 'outbound', subject, text: input.text, from: this.config.smtp.from ?? this.config.mail.username });
    const message = { ...input, subject }; const date = new Date();
    const result = await this.smtpTransport().sendMail({ ...message, from: this.config.smtp.from ?? this.config.mail.username, date, disableFileAccess: true, disableUrlAccess: true });
    if (!result.accepted?.length) throw new Error('SMTP did not accept any recipients');
    const sentCopy = await this.archiveSentCopy(message, result.messageId, date);
    return { messageId: result.messageId, accepted: result.accepted.map(String), rejected: result.rejected.map(String), response: result.response, sentCopy };
  }
  async replyEmail(input: { folder: string; uid: number; text: string; replyAll: boolean }) {
    const original = await this.getMessage(input.folder, input.uid);
    const own = (this.config.smtp.from ?? this.config.mail.username).toLowerCase();
    const to = dedupeAddresses([...original.from.map(entry => entry.address), ...(input.replyAll ? original.to.map(entry => entry.address) : [])].filter(address => address.toLowerCase() !== own));
    const cc = input.replyAll ? dedupeAddresses(original.cc.map(entry => entry.address).filter(address => address.toLowerCase() !== own && !to.includes(address.toLowerCase()))) : [];
    const references = [...new Set([...original.references, ...(original.messageId ? [original.messageId] : [])])];
    // Policy applies to the actual recipients used for this single fetched snapshot.
    const result = await this.sendEmail({ to, ...(cc.length ? { cc } : {}), subject: subjectForReply(original.subject), text: input.text,
      ...(original.messageId ? { inReplyTo: original.messageId } : {}), ...(references.length ? { references } : {}) });
    return { ...result, to, cc };
  }
  private toSummary(message: { uid: number; envelope?: { subject?: string; from?: unknown; to?: unknown }; internalDate?: Date | string; flags?: Set<string> }): MessageSummary {
    const envelope = message.envelope;
    return { uid: message.uid, subject: envelope?.subject || '(no subject)',
      ...(message.internalDate instanceof Date ? { date: message.internalDate.toISOString() } : {}),
      from: envelopeAddresses(envelope?.from), to: envelopeAddresses(envelope?.to), flags: message.flags ? [...message.flags] : [] };
  }
}
