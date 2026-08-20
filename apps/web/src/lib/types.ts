export type MailPriority = "urgent" | "important" | "normal" | "low";

export type MailMessage = {
  uid: number;
  sender: string;
  senderEmail: string;
  subject: string;
  preview: string;
  body?: string;
  receivedAt: string;
  unread: boolean;
  flagged: boolean;
  priority: MailPriority;
  category: string;
  attachments?: number;
};

export type MailListResponse = {
  messages: MailMessage[];
  unread: number;
  total: number;
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
};

export type AiAction = "summarize" | "draft" | "prioritize" | "extract";

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
  requireMfa: boolean;
  sessionTimeoutMinutes: number;
  allowDemoLogin: boolean;
};

export type AuditEvent = {
  id: string;
  actorName: string;
  action: string;
  target: string;
  createdAt: string;
};
