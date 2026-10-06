import type { SecurityAssessment } from "../security/email-security";
import type { AttachmentInspection } from "../security/attachment-scan";

export type MailPriority = "urgent" | "important" | "normal" | "low";
export type MailTag = "follow-up" | "waiting" | "finance" | "legal" | "technology" | "personal";

export type MailAccountSummary = {
  id: string;
  label: string;
  email: string;
  primary: boolean;
  active: boolean;
  imapReady: boolean;
  smtpReady: boolean;
};

export type MailAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  bytes: number;
  vaultState: "available" | "quarantine";
  scanStatus: "clean" | "blocked" | "error" | "not_scanned";
  scanReason: string | null;
  analysisAllowed: boolean;
  extractionStatus: "pending" | "complete" | "unsupported" | "failed";
};

export type MailMessage = {
  uid: number;
  accountId?: string;
  accountLabel?: string;
  direction?: "inbound" | "outbound";
  folder?: string;
  recipientLabel?: string;
  sender: string;
  senderEmail: string;
  subject: string;
  preview: string;
  body?: string;
  bodyLoaded?: boolean;
  hasPlainTextBody?: boolean;
  safeHtmlBody?: string;
  receivedAt: string;
  unread: boolean;
  flagged: boolean;
  tags?: MailTag[];
  priority: MailPriority;
  category: string;
  attachments?: number;
  attachmentFiles?: MailAttachment[];
  aiRuleMatches?: string[];
  aiAutoSummary?: boolean;
  aiSuggestReply?: boolean;
  aiExtractActions?: boolean;
  aiExtractDeadline?: boolean;
  aiEscalate?: boolean;
  security?: SecurityAssessment;
  attachmentInspection?: AttachmentInspection;
};

export type MailListResponse = {
  messages: MailMessage[];
  unread: number;
  total: number;
  hasMore: boolean;
  nextBeforeUid: number | null;
  nextCursor?: string | null;
  accountId?: string;
  accounts?: MailAccountSummary[];
  demo: boolean;
};

export type AppStatus = {
  mode: "live" | "demo";
  authentication: boolean;
  database: boolean;
  demoLogin: boolean;
  imap: boolean;
  smtp: boolean;
  openai: boolean;
  model: string | null;
  aiTone: "concise" | "balanced" | "detailed";
  aiAutoSummarize: boolean;
  aiPriorityDetection: boolean;
  attachmentVault?: {
    bucketsReady: boolean;
    storageApiConfigured: boolean;
    databaseFallback: boolean;
  };
  attachmentScanning?: {
    required: boolean;
    configured: boolean;
    provider: string | null;
    maxBytes: number;
    maxTotalBytes: number;
    maxFiles: number;
  };
};

export type AiAction = "summarize" | "draft" | "prioritize" | "extract";

export type AiRuleActionPolicy = {
  autoSummary?: boolean;
  suggestReply?: boolean;
  extractActions?: boolean;
  extractDeadline?: boolean;
  escalate?: boolean;
  sentiment?: boolean;
  compress?: boolean;
  sensitive?: boolean;
};

export type AiRule = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: MailPriority;
  senderDomains: string[];
  senderAddresses: string[];
  recipientTerms: string[];
  subjectTerms: string[];
  bodyTerms: string[];
  subjectPrefixes: string[];
  requireReply: boolean;
  direction: "inbound" | "outbound" | "both";
  actions: AiRuleActionPolicy;
  active: boolean;
  system: boolean;
  sortOrder: number;
};

export type UserRole = "super_admin" | "admin" | "manager" | "member" | "viewer";
export type UserStatus = "active" | "invited" | "suspended" | "deleted";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  demo: boolean;
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  title: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AlertGroupColor = "blue" | "violet" | "amber" | "red" | "green";

export type AlertGroup = {
  id: string;
  name: string;
  description: string;
  color: AlertGroupColor;
  memberIds: string[];
  active: boolean;
  createdAt: string;
};

export type AdminSettings = {
  organizationName: string;
  workspaceName: string;
  defaultSenderName: string;
  supportEmail: string;
  aiModel: string;
  aiTone: "concise" | "balanced" | "detailed";
  aiAutoSummarize: boolean;
  aiPriorityDetection: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  mailArchiveFolder: string;
  outboundAllowedDomains: string;
  requireMfa: boolean;
  sessionTimeoutMinutes: number;
  allowDemoLogin: boolean;
};

export type ServiceSecretStatus = {
  openaiApiKey: boolean;
  imapPassword: boolean;
  smtpPassword: boolean;
};

export type AuditEvent = {
  id: string;
  actorName: string;
  action: string;
  target: string;
  createdAt: string;
};

export type AiCallStatus = "succeeded" | "failed";

export type AiCallAuditEntry = {
  id: string;
  provider: string;
  operation: string;
  endpoint: string;
  model: string | null;
  actorName: string | null;
  accountId: string | null;
  status: AiCallStatus;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  responseTimeMs: number;
  providerRequestId: string | null;
  errorCode: string | null;
  createdAt: string;
};

export type AiCallAuditSummary = {
  calls: number;
  successes: number;
  failures: number;
  tokenizedCalls: number;
  pricedCalls: number;
  totalTokens: number;
  estimatedCostUsd: number;
  averageResponseTimeMs: number;
};
