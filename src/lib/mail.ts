import "server-only";

import { Buffer } from "node:buffer";
import { MailGateway, type MessageSummary, type ParsedMessage, type SearchCriteria } from "../mail/client";
import { browserMailConfig, mailTagsFromFlags, serviceHost, type MailAction, type MailServiceConfig, type MailTag } from "../mail/policy";
import { getSettings } from "@/lib/admin-data";
import { evaluateAiRules, listAiRules } from "@/lib/ai-rules";
import { persistMessageAttachments } from "@/lib/attachment-records";
import {
  listActiveMailAccounts,
  listMailAccounts,
  PRIMARY_MAIL_ACCOUNT_ID,
  resolveMailAccount,
  type MailAccountRuntime,
} from "@/lib/mail-accounts";
import type { AiRule, MailAccountSummary, MailListResponse, MailMessage, MailPriority } from "@/lib/types";

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

function actualFolder(account: MailAccountRuntime, folder: string) {
  return folder === "INBOX.Sent" ? account.sentFolder : folder;
}

async function runtime(accountId = PRIMARY_MAIL_ACCOUNT_ID, allowInactive = false) {
  const [settings, account] = await Promise.all([
    getSettings(),
    resolveMailAccount(accountId, allowInactive),
  ]);
  const base = browserMailConfig();
  const config: MailServiceConfig = {
    ...base,
    mail: {
      username: account.imapUser,
      password: account.imapPassword,
    },
    imap: {
      host: serviceHost(account.imapHost),
      port: account.imapPort,
      secure: account.imapSecure,
    },
    smtp: {
      host: serviceHost(account.smtpHost),
      port: account.smtpPort,
      secure: account.smtpSecure,
      username: account.smtpUser,
      password: account.smtpPassword,
      from: account.smtpFrom,
    },
    limits: {
      ...base.limits,
      outboundAllowedDomains: constrainedDomains(settings.outboundAllowedDomains, base.limits.outboundAllowedDomains),
    },
  };
  return { settings, account, config, gateway: new MailGateway(config) };
}

export async function mailConfiguration(accountId?: string) {
  if (accountId && accountId !== "all") {
    const { config } = await runtime(accountId, true);
    return {
      imap: Boolean(config.imap.host && config.mail.username && config.mail.password),
      smtp: Boolean(config.smtp.host && config.smtp.username && config.smtp.password && config.smtp.from),
    };
  }
  const accounts = await listMailAccounts(false);
  return {
    imap: accounts.some((account) => account.active && account.imapReady),
    smtp: accounts.some((account) => account.active && account.smtpReady),
  };
}

function inferCategory(sender: string, subject: string) {
  const content = (sender + " " + subject).toLowerCase();
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

function toMessage(
  message: MessageSummary | ParsedMessage,
  priorityDetection: boolean,
  rules: AiRule[],
  folder: string,
  account: Pick<MailAccountRuntime, "id" | "label">,
): MailMessage {
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
    accountId: account.id,
    accountLabel: account.label,
    direction: outbound ? "outbound" : "inbound",
    folder,
    recipientLabel: recipientLabel || undefined,
    sender: from?.name || from?.address || "Unknown sender",
    senderEmail: from?.address || "",
    subject: message.subject,
    preview: parsed
      ? (parsed.text.trim() ? parsed.text.slice(0, 220) : parsed.safeHtmlBody ? "HTML message — open to view securely." : "This message does not contain a displayable body.")
      : "Open this message to load its contents securely.",
    ...(parsed ? {
      bodyLoaded: true,
      hasPlainTextBody: Boolean(parsed.text.trim()),
      ...(parsed.text.trim() ? { body: parsed.text } : {}),
      ...(parsed.safeHtmlBody ? { safeHtmlBody: parsed.safeHtmlBody } : {}),
      security: parsed.security,
      attachmentInspection: parsed.attachmentInspection,
    } : {}),
    receivedAt: message.date || new Date(0).toISOString(),
    unread,
    flagged: message.flags.includes("\\Flagged"),
    tags: mailTagsFromFlags(message.flags),
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

type CombinedCursor = Record<string, number | undefined>;

function encodeCursor(cursor: CombinedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value?: string): CombinedCursor {
  if (!value || value.length > 12000) return {};
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    const cursor: CombinedCursor = {};
    for (const [key, raw] of Object.entries(parsed)) {
      if (typeof raw === "number" && Number.isSafeInteger(raw) && raw > 1 && raw <= 4294967295) cursor[key] = raw;
    }
    return cursor;
  } catch {
    throw new Error("INVALID_MAIL_CURSOR");
  }
}

async function listSingleAccount(
  accountId: string,
  folder: string,
  limit: number,
  beforeUid?: number,
): Promise<MailListResponse> {
  const [{ gateway, config, settings, account }, rules, accounts] = await Promise.all([
    runtime(accountId),
    listAiRules(true),
    listMailAccounts(true),
  ]);
  if (!account.imapReady) throw new Error("MAIL_ACCOUNT_NOT_CONFIGURED");
  const pageLimit = Math.min(limit, config.limits.maxSearchResults);
  const resolvedFolder = actualFolder(account, folder);
  const [page, status] = await Promise.all([
    gateway.listMessagesPage(resolvedFolder, pageLimit, false, undefined, beforeUid),
    gateway.mailboxStatus(resolvedFolder),
  ]);
  const messages = page.messages.map((message) => toMessage(message, settings.aiPriorityDetection, rules, folder, account));
  return {
    messages,
    unread: status.unseen,
    total: status.messages,
    hasMore: page.hasMore,
    nextBeforeUid: page.hasMore && messages.length ? messages[messages.length - 1].uid : null,
    nextCursor: null,
    accountId,
    accounts,
    demo: false,
  };
}

async function listAllAccounts(folder: string, limit: number, cursorValue?: string): Promise<MailListResponse> {
  const accounts = await listActiveMailAccounts();
  if (!accounts.length) throw new Error("MAIL_ACCOUNT_NOT_CONFIGURED");
  const cursors = decodeCursor(cursorValue);
  const rules = await listAiRules(true);

  const pages: Array<{
    account: MailAccountRuntime;
    status: { messages: number; unseen: number };
    page: { messages: MessageSummary[]; hasMore: boolean };
    messages: MailMessage[];
  }> = [];
  const concurrency = 4;
  for (let index = 0; index < accounts.length; index += concurrency) {
    const batch = accounts.slice(index, index + concurrency);
    const loaded = await Promise.all(batch.map(async (summary) => {
      const { gateway, config, settings, account } = await runtime(summary.id);
      const pageLimit = Math.min(limit, config.limits.maxSearchResults);
      const resolvedFolder = actualFolder(account, folder);
      const [page, status] = await Promise.all([
        gateway.listMessagesPage(resolvedFolder, pageLimit, false, undefined, cursors[summary.id]),
        gateway.mailboxStatus(resolvedFolder),
      ]);
      return {
        account,
        status,
        page,
        messages: page.messages.map((message) => toMessage(message, settings.aiPriorityDetection, rules, folder, account)),
      };
    }));
    pages.push(...loaded);
  }

  const candidates = pages.flatMap((page) => page.messages).sort((left, right) => {
    const time = Date.parse(right.receivedAt) - Date.parse(left.receivedAt);
    return time || right.uid - left.uid;
  });
  const messages = candidates.slice(0, limit);
  const next = { ...cursors };
  for (const message of messages) {
    if (!message.accountId) continue;
    const current = next[message.accountId];
    if (current === undefined || message.uid < current) next[message.accountId] = message.uid;
  }
  const hasMore = candidates.length > messages.length || pages.some((page) => page.page.hasMore);
  return {
    messages,
    unread: pages.reduce((sum, page) => sum + page.status.unseen, 0),
    total: pages.reduce((sum, page) => sum + page.status.messages, 0),
    hasMore,
    nextBeforeUid: null,
    nextCursor: hasMore ? encodeCursor(next) : null,
    accountId: "all",
    accounts: await listMailAccounts(true),
    demo: false,
  };
}

export async function listAlertMessages(
  accountId = PRIMARY_MAIL_ACCOUNT_ID,
  limit = 30,
): Promise<{ messages: MailMessage[]; failedFolders: Array<"INBOX" | "INBOX.Sent"> }> {
  const [{ gateway, config, settings, account }, rules] = await Promise.all([
    runtime(accountId),
    listAiRules(true),
  ]);
  if (!account.imapReady) throw new Error("MAIL_ACCOUNT_NOT_CONFIGURED");

  const folders = [
    { logical: "INBOX" as const, actual: actualFolder(account, "INBOX") },
    { logical: "INBOX.Sent" as const, actual: actualFolder(account, "INBOX.Sent") },
  ];
  const pageLimit = Math.min(limit, config.limits.maxSearchResults);
  const snapshots = await gateway.listRecentMessagesByFolders(
    folders.map((folder) => folder.actual),
    pageLimit,
  );

  const messages: MailMessage[] = [];
  const failedFolders: Array<"INBOX" | "INBOX.Sent"> = [];
  snapshots.forEach((snapshot, index) => {
    const folder = folders[index];
    if (snapshot.failed) {
      failedFolders.push(folder.logical);
      return;
    }
    messages.push(...snapshot.messages.map((message) =>
      toMessage(message, settings.aiPriorityDetection, rules, folder.logical, account)
    ));
  });
  return { messages, failedFolders };
}

export async function listMail(
  folder = "INBOX",
  limit = 50,
  beforeUid?: number,
  accountId = PRIMARY_MAIL_ACCOUNT_ID,
  cursor?: string,
): Promise<MailListResponse> {
  if (accountId === "all") return listAllAccounts(folder, limit, cursor);
  return listSingleAccount(accountId, folder, limit, beforeUid);
}

export async function getMail(uid: number, folder = "INBOX", accountId = PRIMARY_MAIL_ACCOUNT_ID): Promise<MailMessage> {
  const { gateway, settings, account } = await runtime(accountId);
  const [{ message, attachmentSources, uidValidity }, rules] = await Promise.all([
    gateway.getMessageWithAttachments(actualFolder(account, folder), uid),
    listAiRules(true),
  ]);
  const logicalFolder = folder === "INBOX.Sent" ? "INBOX.Sent" as const : "INBOX" as const;
  let attachmentFiles: MailMessage["attachmentFiles"] = [];
  if (attachmentSources.length) {
    try {
      attachmentFiles = await persistMessageAttachments({
        accountId,
        folder: logicalFolder,
        uid,
        uidValidity,
        messageId: message.messageId || null,
        messageSubject: message.subject,
        senderEmail: message.from[0]?.address || null,
        toEmails: message.to.map((entry) => entry.address),
        ccEmails: message.cc.map((entry) => entry.address),
        messageDate: message.date || null,
        sources: attachmentSources,
        inspection: message.attachmentInspection,
      });
    } catch (error) {
      console.error("[attachment-vault] message ingestion failed", {
        accountId,
        folder: logicalFolder,
        uid,
        code: error instanceof Error ? error.message.slice(0, 100) : "ERROR",
      });
    }
  }
  return {
    ...toMessage(message, settings.aiPriorityDetection, rules, folder, account),
    ...(attachmentFiles.length ? { attachmentFiles } : {}),
  };
}

export async function searchMailUids(
  folder: "INBOX" | "INBOX.Sent",
  criteria: SearchCriteria,
  accountId = PRIMARY_MAIL_ACCOUNT_ID,
): Promise<number[]> {
  const { gateway, account } = await runtime(accountId);
  return gateway.searchMessageUids(actualFolder(account, folder), criteria);
}

export async function searchMailUidGroups(
  folder: "INBOX" | "INBOX.Sent",
  criteriaList: SearchCriteria[],
  accountId = PRIMARY_MAIL_ACCOUNT_ID,
): Promise<number[][]> {
  const { gateway, account } = await runtime(accountId);
  return gateway.searchMessageUidGroups(actualFolder(account, folder), criteriaList);
}

export async function loadMailResearchMessages(
  folder: "INBOX" | "INBOX.Sent",
  uids: number[],
  limit = 300,
  accountId = PRIMARY_MAIL_ACCOUNT_ID,
) {
  const { gateway, account } = await runtime(accountId);
  return gateway.loadResearchMessages(actualFolder(account, folder), uids, limit);
}

export async function updateMail(
  uid: number,
  action: MailAction,
  folder = "INBOX",
  tag?: MailTag,
  accountId = PRIMARY_MAIL_ACCOUNT_ID,
) {
  const { gateway, account } = await runtime(accountId);
  return gateway.updateMessage(actualFolder(account, folder), uid, action, account.archiveFolder, tag);
}

export async function sendMail(
  input: { to: string; cc?: string; subject: string; text: string },
  accountId = PRIMARY_MAIL_ACCOUNT_ID,
) {
  const { gateway, config, account } = await runtime(accountId);
  if (!account.smtpEnabled || !config.smtp.host || !config.smtp.username || !config.smtp.password || !config.smtp.from) {
    throw new Error("SMTP is not configured");
  }
  return gateway.sendEmail({
    to: [input.to],
    ...(input.cc ? { cc: [input.cc] } : {}),
    subject: input.subject,
    text: input.text,
  });
}

export async function testMailConnection(service: "imap" | "smtp", accountId = PRIMARY_MAIL_ACCOUNT_ID) {
  const { gateway, account } = await runtime(accountId, true);
  if (service === "imap" && !account.imapReady) throw new Error("MAIL_ACCOUNT_NOT_CONFIGURED");
  if (service === "smtp" && !account.smtpReady) throw new Error("SMTP is not configured");
  return service === "imap" ? gateway.testImap() : gateway.testSmtp();
}
