import "server-only";

import { ImapFlow, type MessageAddressObject } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import type { MailListResponse, MailMessage, MailPriority } from "@/lib/types";

function imapUser() {
  return process.env.IMAP_USER || process.env.MAIL_USERNAME;
}

function imapPassword() {
  return process.env.IMAP_PASSWORD || process.env.MAIL_PASSWORD;
}

function smtpUser() {
  return process.env.SMTP_USER || process.env.MAIL_USERNAME;
}

function smtpPassword() {
  return process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD;
}

function smtpFrom() {
  return process.env.SMTP_FROM || process.env.MAIL_USERNAME;
}

export function mailConfiguration() {
  return {
    imap: Boolean(process.env.IMAP_HOST && imapUser() && imapPassword()),
    smtp: Boolean(process.env.SMTP_HOST && smtpUser() && smtpPassword() && smtpFrom()),
  };
}

function getImapClient() {
  if (!mailConfiguration().imap) throw new Error("IMAP is not configured.");

  return new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: process.env.IMAP_SECURE !== "false",
    auth: {
      user: imapUser()!,
      pass: imapPassword()!,
    },
    logger: false,
  });
}

function addressLabel(addresses?: MessageAddressObject[]) {
  const first = addresses?.[0];
  return {
    name: first?.name || first?.address || "Unknown sender",
    email: first?.address || "",
  };
}

function inferCategory(sender: string, subject: string) {
  const content = `${sender} ${subject}`.toLowerCase();
  if (/legal|counsel|trademark|contract|resolution/.test(content)) return "Legal";
  if (/capital|investor|offering|rialto|north capital/.test(content)) return "Capital Markets";
  if (/vercel|deploy|security|api|system/.test(content)) return "Technology";
  return "General";
}

function inferPriority(subject: string, unread: boolean): MailPriority {
  if (/urgent|immediate|action required|deadline/i.test(subject)) return "urgent";
  if (unread || /review|approval|request|next steps/i.test(subject)) return "important";
  return "normal";
}

export async function listMail(folder = "INBOX", limit = 50): Promise<MailListResponse> {
  const client = getImapClient();
  await client.connect();
  const lock = await client.getMailboxLock(folder);

  try {
    const mailbox = client.mailbox;
    if (!mailbox) throw new Error("Unable to open mailbox.");

    const total = mailbox.exists;
    const start = Math.max(1, total - limit + 1);
    const status = await client.status(folder, { unseen: true });
    const fetched = total
      ? await client.fetchAll(`${start}:*`, {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true,
          size: true,
        })
      : [];

    const messages = fetched.reverse().map<MailMessage>((message) => {
      const from = addressLabel(message.envelope?.from);
      const subject = message.envelope?.subject || "(No subject)";
      const unread = !message.flags?.has("\\Seen");
      return {
        uid: message.uid,
        sender: from.name,
        senderEmail: from.email,
        subject,
        preview: "Open this message to load its contents securely.",
        receivedAt: new Date(
          message.envelope?.date || message.internalDate || Date.now(),
        ).toISOString(),
        unread,
        flagged: Boolean(message.flags?.has("\\Flagged")),
        priority: inferPriority(subject, unread),
        category: inferCategory(from.email, subject),
        attachments: 0,
      };
    });

    return {
      messages,
      unread: status.unseen ?? messages.filter((message) => message.unread).length,
      total,
      demo: false,
    };
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
}

export async function getMail(uid: number, folder = "INBOX"): Promise<MailMessage> {
  const client = getImapClient();
  await client.connect();
  const lock = await client.getMailboxLock(folder);

  try {
    const message = await client.fetchOne(
      String(uid),
      { uid: true, envelope: true, flags: true, internalDate: true, source: true },
      { uid: true },
    );
    if (!message || !message.source) throw new Error("Message was not found.");

    const parsed = await simpleParser(message.source);
    const from = addressLabel(message.envelope?.from);
    const subject = message.envelope?.subject || parsed.subject || "(No subject)";
    const unread = !message.flags?.has("\\Seen");

    return {
      uid: message.uid,
      sender: from.name,
      senderEmail: from.email,
      subject,
      preview: parsed.text?.slice(0, 220) || "",
      body: parsed.text || "This message does not contain a plain-text body.",
      receivedAt: new Date(
        message.envelope?.date || message.internalDate || Date.now(),
      ).toISOString(),
      unread,
      flagged: Boolean(message.flags?.has("\\Flagged")),
      priority: inferPriority(subject, unread),
      category: inferCategory(from.email, subject),
      attachments: parsed.attachments.length,
    };
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
}

export async function updateMail(
  uid: number,
  action: "read" | "unread" | "flag" | "unflag" | "archive",
  folder = "INBOX",
) {
  const client = getImapClient();
  await client.connect();
  const lock = await client.getMailboxLock(folder);

  try {
    if (action === "read") return client.messageFlagsAdd([uid], ["\\Seen"], { uid: true });
    if (action === "unread") return client.messageFlagsRemove([uid], ["\\Seen"], { uid: true });
    if (action === "flag") return client.messageFlagsAdd([uid], ["\\Flagged"], { uid: true });
    if (action === "unflag") return client.messageFlagsRemove([uid], ["\\Flagged"], { uid: true });
    return client.messageMove(
      [uid],
      process.env.MAIL_ARCHIVE_FOLDER || "Archive",
      { uid: true },
    );
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
}

export async function sendMail(input: {
  to: string;
  cc?: string;
  subject: string;
  text: string;
}) {
  if (!mailConfiguration().smtp) throw new Error("SMTP is not configured.");

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: {
      user: smtpUser()!,
      pass: smtpPassword()!,
    },
  });

  const result = await transport.sendMail({
    from: smtpFrom()!,
    to: input.to,
    cc: input.cc || undefined,
    subject: input.subject,
    text: input.text,
  });

  return { messageId: result.messageId };
}
