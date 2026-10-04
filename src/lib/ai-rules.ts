import "server-only";

import postgres from "postgres";
import { databaseConnectionString } from "@/lib/auth";
import type { AiRule, MailPriority } from "@/lib/types";

let sqlClient: ReturnType<typeof postgres> | undefined;

function database() {
  const url = databaseConnectionString();
  if (!url) return null;
  if (!sqlClient) {
    sqlClient = postgres(url, {
      max: 2,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: process.env.DATABASE_SSL === "false" ? false : "require",
    });
  }
  return sqlClient;
}

function textArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function mapRule(row: Record<string, unknown>): AiRule {
  const actions = row.actions && typeof row.actions === "object"
    ? row.actions as AiRule["actions"]
    : {};
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description || ""),
    category: String(row.category || "General"),
    priority: row.priority as MailPriority,
    senderDomains: textArray(row.sender_domains),
    senderAddresses: textArray(row.sender_addresses),
    recipientTerms: textArray(row.recipient_terms),
    subjectTerms: textArray(row.subject_terms),
    bodyTerms: textArray(row.body_terms),
    subjectPrefixes: textArray(row.subject_prefixes),
    requireReply: Boolean(row.require_reply),
    actions,
    active: Boolean(row.active),
    system: Boolean(row.system),
    sortOrder: Number(row.sort_order || 100),
  };
}

export async function listAiRules(activeOnly = false): Promise<AiRule[]> {
  const sql = database();
  if (!sql) return [];
  const rows = activeOnly
    ? await sql`SELECT * FROM public.ai_mail_ai_rules WHERE active = TRUE ORDER BY sort_order ASC, title ASC`
    : await sql`SELECT * FROM public.ai_mail_ai_rules ORDER BY sort_order ASC, title ASC`;
  return rows.map((row) => mapRule(row));
}

export async function setAiRuleActive(id: string, active: boolean): Promise<AiRule | null> {
  const sql = database();
  if (!sql) return null;
  const rows = await sql`
    UPDATE public.ai_mail_ai_rules
    SET active = ${active}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? mapRule(rows[0]) : null;
}

export type RuleMessageInput = {
  senderEmail: string;
  recipients?: string[];
  subject: string;
  body?: string;
  isReply?: boolean;
};

const lower = (value: string | undefined) => (value || "").toLowerCase();
const priorityRank: Record<MailPriority, number> = { low: 0, normal: 1, important: 2, urgent: 3 };

function containsAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

function matchesRule(rule: AiRule, message: RuleMessageInput): boolean {
  if (!rule.active) return false;

  const sender = lower(message.senderEmail);
  const senderDomain = sender.includes("@") ? sender.split("@").pop() || "" : "";
  const subject = lower(message.subject);
  const body = lower(message.body);
  const recipients = (message.recipients || []).map(lower);

  if (rule.senderDomains.length && !rule.senderDomains.some((domain) => senderDomain === lower(domain) || senderDomain.endsWith(`.${lower(domain)}`))) return false;
  if (rule.senderAddresses.length && !rule.senderAddresses.some((address) => sender === lower(address))) return false;
  if (rule.recipientTerms.length && !recipients.some((recipient) => containsAny(recipient, rule.recipientTerms))) return false;
  if (rule.subjectPrefixes.length && !rule.subjectPrefixes.some((prefix) => subject.startsWith(lower(prefix)))) return false;
  if (rule.requireReply && !(message.isReply || /^(re|fw|fwd):/i.test(message.subject.trim()))) return false;

  const hasTextCriteria = rule.subjectTerms.length > 0 || rule.bodyTerms.length > 0;
  if (hasTextCriteria) {
    const subjectMatch = rule.subjectTerms.length > 0 && containsAny(subject, rule.subjectTerms);
    const bodyMatch = rule.bodyTerms.length > 0 && containsAny(body, rule.bodyTerms);
    if (!subjectMatch && !bodyMatch) return false;
  }

  return true;
}

export type AiRuleEvaluation = {
  matches: AiRule[];
  category: string | null;
  priority: MailPriority | null;
  autoSummary: boolean;
  suggestReply: boolean;
  extractActions: boolean;
  extractDeadline: boolean;
  escalate: boolean;
  sentiment: boolean;
  compress: boolean;
  sensitive: boolean;
};

export function evaluateAiRules(rules: AiRule[], message: RuleMessageInput): AiRuleEvaluation {
  const matches = rules.filter((rule) => matchesRule(rule, message));
  const category = matches[0]?.category || null;
  const priority = matches.reduce<MailPriority | null>((current, rule) => {
    if (!current || priorityRank[rule.priority] > priorityRank[current]) return rule.priority;
    return current;
  }, null);

  return {
    matches,
    category,
    priority,
    autoSummary: matches.some((rule) => Boolean(rule.actions.autoSummary)),
    suggestReply: matches.some((rule) => Boolean(rule.actions.suggestReply)),
    extractActions: matches.some((rule) => Boolean(rule.actions.extractActions)),
    extractDeadline: matches.some((rule) => Boolean(rule.actions.extractDeadline)),
    escalate: matches.some((rule) => Boolean(rule.actions.escalate)),
    sentiment: matches.some((rule) => Boolean(rule.actions.sentiment)),
    compress: matches.some((rule) => Boolean(rule.actions.compress)),
    sensitive: matches.some((rule) => Boolean(rule.actions.sensitive)),
  };
}
