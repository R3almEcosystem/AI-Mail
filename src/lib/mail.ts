import "server-only";
import { MailGateway, type MessageSummary, type ParsedMessage } from "../mail/client";
import { browserMailConfig, type MailAction } from "../mail/policy";
import type { MailListResponse, MailMessage, MailPriority } from "@/lib/types";

export function mailConfiguration() {
  return {
    imap: Boolean(process.env.IMAP_HOST && (process.env.IMAP_USER || process.env.MAIL_USERNAME) && (process.env.IMAP_PASSWORD || process.env.MAIL_PASSWORD)),
    smtp: Boolean(process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.MAIL_USERNAME) && (process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD) && (process.env.SMTP_FROM || process.env.MAIL_USERNAME)),
  };
}
function gateway() { return new MailGateway(browserMailConfig()); }
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
function toMessage(message: MessageSummary | ParsedMessage): MailMessage {
  const from = message.from[0]; const unread = !message.flags.includes("\\Seen");
  const parsed = "text" in message ? message : null;
  return {
    uid: message.uid, sender: from?.name || from?.address || "Unknown sender", senderEmail: from?.address || "",
    subject: message.subject, preview: parsed ? parsed.text.slice(0, 220) : "Open this message to load its contents securely.",
    ...(parsed ? { body: parsed.text || "This message does not contain a plain-text body.", security: parsed.security, attachmentInspection: parsed.attachmentInspection } : {}),
    receivedAt: message.date || new Date(0).toISOString(), unread, flagged: message.flags.includes("\\Flagged"),
    priority: inferPriority(message.subject, unread), category: inferCategory(from?.address || "", message.subject), attachments: parsed?.attachments.length || 0,
  };
}
export async function listMail(folder = "INBOX", limit = 50): Promise<MailListResponse> {
  const client = gateway(); const config = browserMailConfig();
  const [messages, status] = await Promise.all([client.listMessages(folder, Math.min(limit, config.limits.maxSearchResults), false), client.mailboxStatus(folder)]);
  return { messages: messages.map(toMessage), unread: status.unseen, total: status.messages, demo: false };
}
export async function getMail(uid: number, folder = "INBOX"): Promise<MailMessage> { return toMessage(await gateway().getMessage(folder, uid)); }
export async function updateMail(uid: number, action: MailAction, folder = "INBOX") { return gateway().updateMessage(folder, uid, action, process.env.MAIL_ARCHIVE_FOLDER || "Archive"); }
export async function sendMail(input: { to: string; cc?: string; subject: string; text: string }) {
  if (!mailConfiguration().smtp) throw new Error("SMTP is not configured");
  return gateway().sendEmail({ to: [input.to], ...(input.cc ? { cc: [input.cc] } : {}), subject: input.subject, text: input.text });
}
