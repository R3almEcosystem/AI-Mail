import { ImapFlow, type SearchObject } from 'imapflow';
import nodemailer from 'nodemailer';
import PostalMime from 'postal-mime';
import { assertRecipientsAllowed, envelopeAddresses, dedupeAddresses } from './address.js';
import { normalizeMessageId, subjectForReply, stripHeaderNewlines, clampText } from './sanitize.js';
import { assertMessageIdentity, type MailServiceConfig, type MailAction } from './policy.js';

export type MessageSummary = {
  uid: number; subject: string; date?: string;
  from: Array<{ name?: string; address: string }>;
  to: Array<{ name?: string; address: string }>; flags: string[];
};
export type ParsedMessage = MessageSummary & {
  cc: Array<{ name?: string; address: string }>;
  messageId?: string; inReplyTo?: string; references: string[]; text: string;
  attachments: Array<{ filename?: string; mimeType?: string; disposition?: string; related?: boolean; contentId?: string }>;
};
export type SearchCriteria = { from?: string; to?: string; cc?: string; subject?: string; text?: string; unreadOnly?: boolean; since?: Date; before?: Date };
type SendInput = { to: string[]; cc?: string[]; bcc?: string[]; subject: string; text: string; inReplyTo?: string; references?: string[] };
type SentCopyStatus = { stored: boolean; folder?: string; uid?: number; warning?: string };
const tlsOptions = (host: string) => ({ rejectUnauthorized: true, minVersion: 'TLSv1.2' as const, servername: host });

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
  private async withImap<T>(operation: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.createImapClient(); let connected = false;
    try { await client.connect(); connected = true; return await operation(client); }
    finally {
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
  async testConnections(): Promise<{ imap: 'ok'; smtp: 'ok' }> {
    await this.withImap(async () => undefined); await this.smtpTransport().verify();
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
  async listMessages(folder: string, limit: number, unreadOnly: boolean, since?: Date): Promise<MessageSummary[]> {
    return this.searchMessages(folder, { unreadOnly, ...(since ? { since } : {}) }, limit);
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
  async getMessage(folder: string, uid: number): Promise<ParsedMessage> {
    assertMessageIdentity(folder, uid);
    return this.withMailbox(folder, async client => {
      const metadata = await client.fetchOne(uid, { size: true }, { uid: true });
      if (!metadata) throw new Error('Message not found');
      if (typeof metadata.size !== 'number' || !Number.isSafeInteger(metadata.size) || metadata.size < 0 || metadata.size > this.config.limits.maxRawMessageBytes) throw new Error('Message exceeds the raw-message size limit or its size is unknown');
      const message = await client.fetchOne(uid, { envelope: true, flags: true, internalDate: true, source: true }, { uid: true });
      if (!message || !message.source) throw new Error('Message not found');
      if (message.source.byteLength > this.config.limits.maxRawMessageBytes) throw new Error('Message exceeds the raw-message size limit');
      const parsed = await PostalMime.parse(message.source, { maxNestingDepth: 50 });
      const headers = new Map<string, string>(parsed.headers.map(header => [header.key.toLowerCase(), header.value] as [string, string]));
      return {
        ...this.toSummary(message), cc: envelopeAddresses(message.envelope?.cc),
        messageId: normalizeMessageId(parsed.messageId || message.envelope?.messageId),
        inReplyTo: normalizeMessageId(headers.get('in-reply-to')),
        references: (headers.get('references') || '').split(/\s+/).slice(0, 100).map(normalizeMessageId).filter((id): id is string => Boolean(id)),
        text: clampText(parsed.text || '', this.config.limits.maxMessageBodyChars),
        attachments: parsed.attachments.map(attachment => ({
          ...(attachment.filename ? { filename: attachment.filename } : {}), ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
          ...(attachment.disposition ? { disposition: attachment.disposition } : {}), ...(attachment.related !== undefined ? { related: attachment.related } : {}),
          ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
        })),
      };
    });
  }
  async updateMessage(folder: string, uid: number, action: MailAction, archiveFolder = 'Archive') {
    assertMessageIdentity(folder, uid);
    if (!['read', 'unread', 'flag', 'unflag', 'archive'].includes(action)) throw new Error('Invalid mailbox action');
    if (action === 'archive') return this.moveMessage(folder, uid, archiveFolder);
    return this.withMailbox(folder, async client => {
      const flag = action === 'read' || action === 'unread' ? '\\Seen' : '\\Flagged';
      const result = action === 'read' || action === 'flag'
        ? await client.messageFlagsAdd(uid, [flag], { uid: true })
        : await client.messageFlagsRemove(uid, [flag], { uid: true });
      if (result !== true) throw new Error('IMAP did not confirm the flag change');
      return { uid, action };
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
