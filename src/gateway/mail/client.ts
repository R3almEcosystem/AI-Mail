import { ImapFlow, type SearchObject } from 'imapflow';
import nodemailer, { type Transporter } from 'nodemailer';
import PostalMime from 'postal-mime';
import type { AppConfig } from '../config.js';
import { envelopeAddresses, dedupeAddresses } from './address.js';
import { normalizeMessageId, subjectForReply } from './sanitize.js';

export type MessageSummary = {
  uid: number;
  subject: string;
  date?: string;
  from: Array<{ name?: string; address: string }>;
  to: Array<{ name?: string; address: string }>;
  flags: string[];
};

export type ParsedMessage = MessageSummary & {
  cc: Array<{ name?: string; address: string }>;
  messageId?: string;
  inReplyTo?: string;
  references: string[];
  text: string;
  attachments: Array<{
    filename?: string;
    mimeType?: string;
    disposition?: string;
    related?: boolean;
    contentId?: string;
  }>;
};

export type SearchCriteria = {
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  text?: string;
  unreadOnly?: boolean;
  since?: Date;
  before?: Date;
};

type SentCopyStatus = {
  stored: boolean;
  folder?: string;
  uid?: number;
  warning?: string;
};

function tlsOptions(host: string) {
  return {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2' as const,
    servername: host
  };
}

export class MailGateway {
  private readonly transporter: Transporter;
  private readonly archivalTransporter: Transporter;

  constructor(private readonly config: AppConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.mail.username,
        pass: config.mail.password
      },
      tls: tlsOptions(config.smtp.host),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      disableFileAccess: true,
      disableUrlAccess: true
    });

    // Stream transport compiles a complete RFC 822 copy without delivering it.
    // We append this copy to the IMAP Sent mailbox only after SMTP succeeds.
    this.archivalTransporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      disableFileAccess: true,
      disableUrlAccess: true
    });
  }

  private createImapClient(): ImapFlow {
    return new ImapFlow({
      host: this.config.imap.host,
      port: this.config.imap.port,
      secure: this.config.imap.secure,
      auth: {
        user: this.config.mail.username,
        pass: this.config.mail.password
      },
      tls: tlsOptions(this.config.imap.host),
      logger: false,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000
    });
  }

  private async withImap<T>(operation: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.createImapClient();
    await client.connect();
    try {
      return await operation(client);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private async archiveSentCopy(input: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text: string;
    messageId: string;
    date: Date;
    inReplyTo?: string;
    references?: string[];
  }): Promise<SentCopyStatus> {
    try {
      const compiled = await this.archivalTransporter.sendMail({
        from: this.config.mail.username,
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        text: input.text,
        messageId: input.messageId,
        date: input.date,
        ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
        ...(input.references?.length ? { references: input.references } : {}),
        disableFileAccess: true,
        disableUrlAccess: true
      });

      const raw = (compiled as unknown as { message?: unknown }).message;
      if (!Buffer.isBuffer(raw)) {
        throw new Error('Sent-copy composer did not return a Buffer');
      }

      return await this.withImap(async (client) => {
        const mailboxes = await client.list();
        const sentFolder = mailboxes.find((mailbox) => mailbox.specialUse === '\\Sent')?.path ?? 'INBOX.Sent';
        const appended = await client.append(sentFolder, raw, ['\\Seen'], input.date);

        return {
          stored: true,
          folder: sentFolder,
          ...(appended && typeof appended.uid === 'number' ? { uid: appended.uid } : {})
        };
      });
    } catch (error) {
      return {
        stored: false,
        warning: error instanceof Error ? error.message : 'Unknown Sent-folder archival error'
      };
    }
  }

  async testConnections(): Promise<{ imap: 'ok'; smtp: 'ok' }> {
    await this.withImap(async () => undefined);
    await this.transporter.verify();
    return { imap: 'ok', smtp: 'ok' };
  }

  async listMailboxes(): Promise<Array<{ path: string; specialUse?: string; messages?: number; unseen?: number }>> {
    return this.withImap(async (client) => {
      const mailboxes = await client.list({ statusQuery: { messages: true, unseen: true } });
      return mailboxes.map((mailbox) => ({
        path: mailbox.path,
        ...(mailbox.specialUse ? { specialUse: mailbox.specialUse } : {}),
        ...(mailbox.status?.messages !== undefined ? { messages: mailbox.status.messages } : {}),
        ...(mailbox.status?.unseen !== undefined ? { unseen: mailbox.status.unseen } : {})
      }));
    });
  }

  async mailboxStatus(path: string) {
    return this.withImap(async (client) => {
      const status = await client.status(path, {
        messages: true,
        unseen: true,
        uidNext: true,
        uidValidity: true
      });
      return {
        path,
        messages: status.messages ?? 0,
        unseen: status.unseen ?? 0,
        uidNext: status.uidNext ?? null,
        uidValidity: status.uidValidity?.toString() ?? null
      };
    });
  }

  async searchMessages(folder: string, criteria: SearchCriteria, limit: number): Promise<MessageSummary[]> {
    return this.withImap(async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const query: SearchObject = {};
        if (criteria.from) query.from = criteria.from;
        if (criteria.to) query.to = criteria.to;
        if (criteria.cc) query.cc = criteria.cc;
        if (criteria.subject) query.subject = criteria.subject;
        if (criteria.text) query.text = criteria.text;
        if (criteria.unreadOnly) query.seen = false;
        if (criteria.since) query.since = criteria.since;
        if (criteria.before) query.before = criteria.before;

        if (Object.keys(query).length === 0) query.all = true;
        const searchResult = await client.search(query, { uid: true });
        const uids = Array.isArray(searchResult) ? searchResult : [];
        const selected = uids.slice(-limit);
        if (selected.length === 0) return [];

        const messages = await client.fetchAll(
          selected,
          { envelope: true, flags: true, internalDate: true },
          { uid: true }
        );
        return messages
          .map((message) => this.toSummary(message))
          .sort((a, b) => b.uid - a.uid);
      } finally {
        lock.release();
      }
    });
  }

  async listMessages(folder: string, limit: number, unreadOnly: boolean, since?: Date): Promise<MessageSummary[]> {
    return this.searchMessages(folder, { unreadOnly, ...(since ? { since } : {}) }, limit);
  }

  async getMessage(folder: string, uid: number): Promise<ParsedMessage> {
    return this.withImap(async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const metadata = await client.fetchOne(
          uid,
          { envelope: true, flags: true, internalDate: true, size: true },
          { uid: true }
        );
        if (!metadata) throw new Error(`Message UID ${uid} not found in ${folder}`);
        if (typeof metadata.size === 'number' && metadata.size > this.config.limits.maxRawMessageBytes) {
          throw new Error(`Message UID ${uid} exceeds the configured raw-message size limit`);
        }

        const message = await client.fetchOne(
          uid,
          { envelope: true, flags: true, internalDate: true, source: true },
          { uid: true }
        );
        if (!message || !message.source) throw new Error(`Message UID ${uid} not found in ${folder}`);

        const parsed = await PostalMime.parse(message.source, { maxNestingDepth: 50 });
        const summary = this.toSummary(message);
        const headers = new Map<string, string>(
          parsed.headers.map((header) => [header.key.toLowerCase(), header.value] as [string, string])
        );
        const references = (headers.get('references') || '')
          .split(/\s+/)
          .map((value) => normalizeMessageId(value))
          .filter((value): value is string => Boolean(value));

        return {
          ...summary,
          cc: envelopeAddresses(message.envelope?.cc),
          messageId: normalizeMessageId(parsed.messageId || message.envelope?.messageId),
          inReplyTo: normalizeMessageId(headers.get('in-reply-to')),
          references,
          text: parsed.text || '',
          attachments: parsed.attachments.map((attachment) => ({
            ...(attachment.filename ? { filename: attachment.filename } : {}),
            ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
            ...(attachment.disposition ? { disposition: attachment.disposition } : {}),
            ...(attachment.related !== undefined ? { related: attachment.related } : {}),
            ...(attachment.contentId ? { contentId: attachment.contentId } : {})
          }))
        };
      } finally {
        lock.release();
      }
    });
  }

  async markRead(folder: string, uid: number): Promise<{ uid: number; read: true }> {
    return this.withImap(async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        return { uid, read: true as const };
      } finally {
        lock.release();
      }
    });
  }

  async moveMessage(folder: string, uid: number, destination: string): Promise<{ uid: number; destination: string }> {
    return this.withImap(async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageMove(uid, destination, { uid: true });
        return { uid, destination };
      } finally {
        lock.release();
      }
    });
  }

  async sendEmail(input: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; text: string }) {
    const sentAt = new Date();
    const result = await this.transporter.sendMail({
      from: this.config.mail.username,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      date: sentAt,
      disableFileAccess: true,
      disableUrlAccess: true
    });

    const sentCopy = await this.archiveSentCopy({
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      messageId: result.messageId,
      date: sentAt
    });

    return {
      messageId: result.messageId,
      accepted: result.accepted.map(String),
      rejected: result.rejected.map(String),
      response: result.response,
      sentCopy
    };
  }

  async replyEmail(input: { folder: string; uid: number; text: string; replyAll: boolean }) {
    const original = await this.getMessage(input.folder, input.uid);
    const own = this.config.mail.username.toLowerCase();
    const originalFrom = original.from.map((entry) => entry.address);
    const originalTo = original.to.map((entry) => entry.address);
    const originalCc = original.cc.map((entry) => entry.address);

    const to = dedupeAddresses(
      input.replyAll
        ? [...originalFrom, ...originalTo].filter((address) => address.toLowerCase() !== own)
        : originalFrom
    );
    const cc = input.replyAll
      ? dedupeAddresses(originalCc.filter((address) => address.toLowerCase() !== own && !to.includes(address.toLowerCase())))
      : [];

    if (to.length === 0) throw new Error('Could not determine a reply recipient');

    const referenceIds = [...original.references];
    if (original.messageId) referenceIds.push(original.messageId);
    const references = [...new Set(referenceIds)];
    const subject = subjectForReply(original.subject);
    const sentAt = new Date();

    const result = await this.transporter.sendMail({
      from: this.config.mail.username,
      to,
      ...(cc.length ? { cc } : {}),
      subject,
      text: input.text,
      date: sentAt,
      ...(original.messageId ? { inReplyTo: original.messageId } : {}),
      ...(references.length ? { references } : {}),
      disableFileAccess: true,
      disableUrlAccess: true
    });

    const sentCopy = await this.archiveSentCopy({
      to,
      ...(cc.length ? { cc } : {}),
      subject,
      text: input.text,
      messageId: result.messageId,
      date: sentAt,
      ...(original.messageId ? { inReplyTo: original.messageId } : {}),
      ...(references.length ? { references } : {})
    });

    return {
      messageId: result.messageId,
      to,
      cc,
      accepted: result.accepted.map(String),
      rejected: result.rejected.map(String),
      response: result.response,
      sentCopy
    };
  }

  private toSummary(message: any): MessageSummary {
    const envelope = message.envelope ?? {};
    return {
      uid: Number(message.uid),
      subject: typeof envelope.subject === 'string' ? envelope.subject : '(no subject)',
      ...(message.internalDate instanceof Date ? { date: message.internalDate.toISOString() } : {}),
      from: envelopeAddresses(envelope.from),
      to: envelopeAddresses(envelope.to),
      flags: message.flags ? [...message.flags].map(String) : []
    };
  }
}
