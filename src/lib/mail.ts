import "server-only";
import { MailGateway, type MessageSummary, type ParsedMessage } from "../mail/client";
import { browserMailConfig, serviceHost, type MailAction, type MailServiceConfig } from "../mail/policy";
import { getSettings } from "@/lib/admin-data";
import { getServiceSecret } from "@/lib/service-secrets";
import { evaluateAiRules, listAiRules } from "@/lib/ai-rules";
import type { AiRule } from "@/lib/types";
import type { MailListResponse, MailMessage, MailPriority } from "@/lib/types";

function domainList(value: string): string[] {
  return value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
}

function constrainedDomains(databaseValue: string, environmentValue: readonly string[]): string[] {
  const configured = domainList(databaseValue);
  if (!configured.length) return [...environmentValue];
  if (!environmentValue.length) return configured;
  const environment = new Set(environmentValue);
  return configured.filter((domain) => environment.has(domain));
}

async function runtime() {
  const [settings, imapVaultPassword, smtpVaultPassword] = await Promise.all([
    getSettings(),
    getServiceSecret("ai_mail_imap_password"),
    getServiceSecret("ai_mail_smtp_password"),
  ]);
  const base = browserMailConfig();
  const imapPassword = imapVaultPassword || process.env.IMAP_PASSWORD || process.env.MAIL_PASSWORD || base.mail.password;
  const smtpPassword = smtpVaultPassword || process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD || base.smtp.password || base.mail.password;
  const config: MailServiceConfig = {
    ...base,
    mail: {
      username: settings.imapUser,
      password: imapPassword,
    },
    imap: {
      host: serviceHost(settings.imapHost),
      port: settings.imapPort,
      secure: settings.imapSecure,
    },
    smtp: {
      host: serviceHost(settings.smtpHost),
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      username: settings.smtpUser,
      password: smtpPassword,
      from: settings.smtpFrom,
    },
    limits: {
      ...base.limits,
      outboundAllowedDomains: constrainedDomains(settings.outboundAllowedDomains, base.limits.outboundAllowedDomains),
    },
  };
  return { settings, config, gateway: new MailGateway(config) };
}

export async function mailConfiguration() {
  const { config } = await runtime();
  return {
    imap: Boolean(config.imap.host && config.mail.username && config.mail.password),
    smtp: Boolean(config.smtp.host && config.smtp.username && config.smtp.password && config.smtp.from),
  };
}

function inferCategory(sender: string, subject: string) {
  const content = `${sender} ${subject}`.toLowerCase();
  if (/legal|counsel|trademark|contract|resolution/.test(content)) return "Legal";
  if (/capital|investor|offering|rialto|north capital/.test(content)) return "Capital Markets";
  if (/vercel|deploy|security|api|system/.test(content)) return "Technology";
  return "General";
}

function inferPriority(subject: string, unread: boolean, enabled: boolean): MailPriority {
  if (!enabled) return "normal";
  if (/urgent|immediate|action required|deadline/i.test(subject)) return "urgent";
  if (unread || /review|approval|request|next steps/i.test(subject)) return "important";
  return "normal";
}

function toMessage(message: MessageSummary | ParsedMessage, priorityDetection: boolean, rules: AiRule[], folder: string): MailMessage {
  const from = message.from[0];
  const unread = !message.flags.includes("\\Seen");
  const parsed = "text" in message ? message : null;
  const outbound = folder === "INBOX.Sent";
  const recipientLabel = message.to.map((recipient) => recipient.name || recipient.address).filter(Boolean).join(", ");
  const ruleEvaluation = evaluateAiRules(rules, {
    senderEmail: from?.address || "",
    recipients: message.to.map((recipient) => recipient.address),
    subject: message.subject,
    body: parsed?.text,
    isReply: /^(re|fw|fwd):/i.test(message.subject.trim()),
    direction: outbound ? "outbound" : "inbound",
  });
  return {
    uid: message.uid,
    direction: outbound ? "outbound" : "inbound",
    folder,
    recipientLabel: recipientLabel || undefined,
    sender: from?.name || from?.address || "Unknown sender",
    senderEmail: from?.address || "",
    subject: message.subject,
    preview: parsed ? parsed.text.slice(0, 220) : "Open this message to load its contents securely.",
    ...(parsed ? { body: parsed.text || "This message does not contain a plain-text body.", security: parsed.security, attachmentInspection: parsed.attachmentInspection } : {}),
    receivedAt: message.date || new Date(0).toISOString(),
    unread,
    flagged: message.flags.includes("\\Flagged"),
    priority: ruleEvaluation.priority || inferPriority(message.subject, unread, priorityDetection),
    category: ruleEvaluation.category || inferCategory(from?.address || "", message.subject),
    attachments: parsed?.attachments.length || 0,
    aiRuleMatches: ruleEvaluation.matches.map((rule) => rule.id),
    aiAutoSummary: ruleEvaluation.autoSummary,
    aiSuggestReply: ruleEvaluation.suggestReply,
    aiExtractActions: ruleEvaluation.extractActions,
    aiExtractDeadline: ruleEvaluation.extractDeadline,
    aiEscalate: ruleEvaluation.escalate,
  };
}

export async function listMail(folder = "INBOX", limit = 50, beforeUid?: number): Promise<MailListResponse> {
  const { gateway, config, settings } = await runtime();
  const pageLimit = Math.min(limit, config.limits.maxSearchResults);
  const [page, status, rules] = await Promise.all([
    gateway.listMessagesPage(folder, pageLimit, false, undefined, beforeUid),
    gateway.mailboxStatus(folder),
    listAiRules(true),
  ]);
  const messages = page.messages.map((message) => toMessage(message, settings.aiPriorityDetection, rules, folder));
  return {
    messages,
    unread: status.unseen,
    total: status.messages,
    hasMore: page.hasMore,
    nextBeforeUid: page.hasMore && messages.length ? messages[messages.length - 1].uid : null,
    demo: false,
  };
}

export async function getMail(uid: number, folder = "INBOX"): Promise<MailMessage> {
  const { gateway, settings } = await runtime();
  const [message, rules] = await Promise.all([
    gateway.getMessage(folder, uid),
    listAiRules(true),
  ]);
  return toMessage(message, settings.aiPriorityDetection, rules, folder);
}

export async function updateMail(uid: number, action: MailAction, folder = "INBOX") {
  const { gateway, settings } = await runtime();
  return gateway.updateMessage(folder, uid, action, settings.mailArchiveFolder);
}

export async function sendMail(input: { to: string; cc?: string; subject: string; text: string }) {
  const { gateway, config } = await runtime();
  if (!config.smtp.host || !config.smtp.username || !config.smtp.password || !config.smtp.from) throw new Error("SMTP is not configured");
  return gateway.sendEmail({
    to: [input.to],
    ...(input.cc ? { cc: [input.cc] } : {}),
    subject: input.subject,
    text: input.text,
  });
}

export async function testMailConnection(service: "imap" | "smtp") {
  const { gateway } = await runtime();
  return service === "imap" ? gateway.testImap() : gateway.testSmtp();
}
