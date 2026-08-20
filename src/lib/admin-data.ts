import "server-only";

import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import type {
  AdminSettings,
  AlertGroup,
  AlertGroupColor,
  AuditEvent,
  ManagedUser,
  SessionUser,
  UserRole,
  UserStatus,
} from "@/lib/types";

const scrypt = promisify(scryptCallback);
type SqlClient = ReturnType<typeof postgres>;

let client: SqlClient | null = null;
let schemaPromise: Promise<void> | null = null;

const defaultSettings: AdminSettings = {
  organizationName: "r3alm",
  workspaceName: "AI-Mail Executive Workspace",
  defaultSenderName: "Bernie O’Neill",
  supportEmail: "support@r3alm.com",
  aiModel: "gpt-5.2",
  aiTone: "concise",
  aiAutoSummarize: true,
  aiPriorityDetection: true,
  requireMfa: false,
  sessionTimeoutMinutes: 720,
  allowDemoLogin: true,
};

let demoUsers: ManagedUser[] = [
  { id: "demo-bernie", name: "Bernie O’Neill", email: "bernie@r3alm.com", title: "Director / Engineer", role: "super_admin", status: "active", lastLoginAt: "2026-08-19T13:52:00.000Z", createdAt: "2026-01-08T14:00:00.000Z" },
  { id: "demo-maya", name: "Maya Chen", email: "maya@r3alm.com", title: "Operations Lead", role: "admin", status: "active", lastLoginAt: "2026-08-19T12:19:00.000Z", createdAt: "2026-03-14T15:00:00.000Z" },
  { id: "demo-jordan", name: "Jordan Ellis", email: "jordan@r3alm.com", title: "Client Strategy", role: "manager", status: "active", lastLoginAt: "2026-08-18T20:42:00.000Z", createdAt: "2026-04-02T15:00:00.000Z" },
  { id: "demo-alex", name: "Alex Rivera", email: "alex@r3alm.com", title: "Engineering", role: "member", status: "invited", lastLoginAt: null, createdAt: "2026-08-17T16:30:00.000Z" },
  { id: "demo-samira", name: "Samira Patel", email: "samira@r3alm.com", title: "Finance Advisor", role: "viewer", status: "suspended", lastLoginAt: "2026-08-03T17:12:00.000Z", createdAt: "2026-05-21T15:00:00.000Z" },
];

let demoAlertGroups: AlertGroup[] = [
  { id: "group-executive", name: "Executive Response", description: "Time-sensitive decisions, approvals, and executive follow-up.", color: "violet", memberIds: ["demo-bernie", "demo-maya"], active: true, createdAt: "2026-08-19T14:00:00.000Z" },
  { id: "group-legal", name: "Legal & Compliance", description: "Corporate, regulatory, trademark, and governance matters.", color: "red", memberIds: ["demo-bernie", "demo-jordan", "demo-samira"], active: true, createdAt: "2026-08-19T14:05:00.000Z" },
  { id: "group-engineering", name: "Engineering", description: "Security, integrations, infrastructure, and product incidents.", color: "blue", memberIds: ["demo-bernie", "demo-alex"], active: true, createdAt: "2026-08-19T14:10:00.000Z" },
  { id: "group-operations", name: "Operations", description: "Mailbox workflows, document routing, and client coordination.", color: "green", memberIds: ["demo-maya", "demo-jordan"], active: true, createdAt: "2026-08-19T14:15:00.000Z" },
];

let demoSettings = { ...defaultSettings };
let demoAudit: AuditEvent[] = [
  { id: "audit-1", actorName: "Bernie O’Neill", action: "Signed in with demo access", target: "AI-Mail Console", createdAt: "2026-08-19T13:52:00.000Z" },
  { id: "audit-2", actorName: "Maya Chen", action: "Changed role to Manager", target: "Jordan Ellis", createdAt: "2026-08-19T12:07:00.000Z" },
  { id: "audit-3", actorName: "Bernie O’Neill", action: "Updated AI policy", target: "Executive triage", createdAt: "2026-08-18T21:16:00.000Z" },
  { id: "audit-4", actorName: "Maya Chen", action: "Invited user", target: "Alex Rivera", createdAt: "2026-08-17T16:30:00.000Z" },
  { id: "audit-5", actorName: "Bernie O’Neill", action: "Reviewed mail connection", target: "Primary mailbox", createdAt: "2026-08-16T18:40:00.000Z" },
];

function getClient() {
  if (!process.env.DATABASE_URL) return null;
  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: process.env.DATABASE_SSL === "false" ? false : "require",
    });
  }
  return client;
}

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureSchema(sql: SqlClient) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS ai_mail_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        password_hash TEXT,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ai_mail_settings (
        id TEXT PRIMARY KEY,
        organization_name TEXT NOT NULL,
        workspace_name TEXT NOT NULL,
        default_sender_name TEXT NOT NULL,
        support_email TEXT NOT NULL,
        ai_model TEXT NOT NULL,
        ai_tone TEXT NOT NULL,
        ai_auto_summarize BOOLEAN NOT NULL,
        ai_priority_detection BOOLEAN NOT NULL,
        require_mfa BOOLEAN NOT NULL,
        session_timeout_minutes INTEGER NOT NULL,
        allow_demo_login BOOLEAN NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ai_mail_audit_events (
        id TEXT PRIMARY KEY,
        actor_id TEXT,
        actor_name TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ai_mail_alert_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT 'blue',
        member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO ai_mail_settings (
        id, organization_name, workspace_name, default_sender_name, support_email,
        ai_model, ai_tone, ai_auto_summarize, ai_priority_detection, require_mfa,
        session_timeout_minutes, allow_demo_login
      ) VALUES (
        'default', ${defaultSettings.organizationName}, ${defaultSettings.workspaceName},
        ${defaultSettings.defaultSenderName}, ${defaultSettings.supportEmail},
        ${defaultSettings.aiModel}, ${defaultSettings.aiTone}, ${defaultSettings.aiAutoSummarize},
        ${defaultSettings.aiPriorityDetection}, ${defaultSettings.requireMfa},
        ${defaultSettings.sessionTimeoutMinutes}, ${defaultSettings.allowDemoLogin}
      ) ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO ai_mail_alert_groups (id, name, description, color, member_ids, active)
      VALUES
        ('group-executive', 'Executive Response', 'Time-sensitive decisions, approvals, and executive follow-up.', 'violet', '[]'::jsonb, TRUE),
        ('group-legal', 'Legal & Compliance', 'Corporate, regulatory, trademark, and governance matters.', 'red', '[]'::jsonb, TRUE),
        ('group-engineering', 'Engineering', 'Security, integrations, infrastructure, and product incidents.', 'blue', '[]'::jsonb, TRUE),
        ('group-operations', 'Operations', 'Mailbox workflows, document routing, and client coordination.', 'green', '[]'::jsonb, TRUE)
      ON CONFLICT DO NOTHING
    `;

    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (initialPassword) {
      const passwordHash = await hashPassword(initialPassword);
      await sql`
        INSERT INTO ai_mail_users (id, name, email, title, role, status, password_hash)
        VALUES (
          'owner-bernie', 'Bernie O’Neill', ${process.env.ADMIN_INITIAL_EMAIL || "bernie@r3alm.com"},
          'Director / Engineer', 'super_admin', 'active', ${passwordHash}
        ) ON CONFLICT (email) DO NOTHING
      `;
    }
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

function iso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function mapUser(row: Record<string, unknown>): ManagedUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    title: String(row.title || ""),
    role: row.role as UserRole,
    status: row.status as UserStatus,
    lastLoginAt: iso(row.last_login_at),
    createdAt: iso(row.created_at) || new Date(0).toISOString(),
  };
}

function mapSettings(row: Record<string, unknown>): AdminSettings {
  return {
    organizationName: String(row.organization_name),
    workspaceName: String(row.workspace_name),
    defaultSenderName: String(row.default_sender_name),
    supportEmail: String(row.support_email),
    aiModel: String(row.ai_model),
    aiTone: row.ai_tone as AdminSettings["aiTone"],
    aiAutoSummarize: Boolean(row.ai_auto_summarize),
    aiPriorityDetection: Boolean(row.ai_priority_detection),
    requireMfa: Boolean(row.require_mfa),
    sessionTimeoutMinutes: Number(row.session_timeout_minutes),
    allowDemoLogin: Boolean(row.allow_demo_login),
  };
}

function mapAlertGroup(row: Record<string, unknown>): AlertGroup {
  const memberIds = Array.isArray(row.member_ids)
    ? row.member_ids.map(String)
    : JSON.parse(String(row.member_ids || "[]")) as string[];
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description || ""),
    color: row.color as AlertGroupColor,
    memberIds,
    active: Boolean(row.active),
    createdAt: iso(row.created_at) || new Date(0).toISOString(),
  };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded?: string | null) {
  if (!encoded) return false;
  const [scheme, salt, stored] = encoded.split("$");
  if (scheme !== "scrypt" || !salt || !stored) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(stored, "hex");
  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}

export async function findUserForLogin(email: string) {
  const sql = getClient();
  if (!sql) return null;
  await ensureSchema(sql);
  const rows = await sql`
    SELECT id, name, email, role, status, password_hash
    FROM ai_mail_users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    user: {
      id: String(rows[0].id),
      name: String(rows[0].name),
      email: String(rows[0].email),
      role: rows[0].role as UserRole,
      demo: false,
    } satisfies SessionUser,
    status: rows[0].status as UserStatus,
    passwordHash: rows[0].password_hash ? String(rows[0].password_hash) : null,
  };
}

export async function recordLogin(user: SessionUser) {
  const sql = getClient();
  if (!sql || user.demo) return;
  await ensureSchema(sql);
  await Promise.all([
    sql`UPDATE ai_mail_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ${user.id}`,
    addAudit(user, "Signed in", "AI-Mail Console"),
  ]);
}

export async function listUsers() {
  const sql = getClient();
  if (!sql) return demoUsers.map((user) => ({ ...user }));
  await ensureSchema(sql);
  const rows = await sql`SELECT * FROM ai_mail_users ORDER BY created_at ASC`;
  return rows.map((row) => mapUser(row));
}

export type CreateUserInput = {
  name: string;
  email: string;
  title: string;
  role: UserRole;
  status: UserStatus;
  password?: string;
};

export async function createUser(input: CreateUserInput, actor: SessionUser) {
  const user: ManagedUser = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email.toLowerCase(),
    title: input.title,
    role: input.role,
    status: input.status,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
  };
  const sql = getClient();
  if (!sql) {
    if (demoUsers.some((item) => item.email.toLowerCase() === user.email)) {
      throw new Error("EMAIL_EXISTS");
    }
    demoUsers = [...demoUsers, user];
    await addAudit(actor, input.status === "invited" ? "Invited user" : "Created user", user.name);
    return user;
  }
  await ensureSchema(sql);
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  try {
    await sql`
      INSERT INTO ai_mail_users (id, name, email, title, role, status, password_hash, created_at)
      VALUES (${user.id}, ${user.name}, ${user.email}, ${user.title}, ${user.role}, ${user.status}, ${passwordHash}, ${user.createdAt})
    `;
  } catch (error) {
    if (String(error).includes("unique")) throw new Error("EMAIL_EXISTS");
    throw error;
  }
  await addAudit(actor, input.status === "invited" ? "Invited user" : "Created user", user.name);
  return user;
}

export type UpdateUserInput = Partial<Pick<ManagedUser, "name" | "email" | "title" | "role" | "status">> & { password?: string };

export async function updateUser(id: string, input: UpdateUserInput, actor: SessionUser) {
  const sql = getClient();
  const current = sql
    ? (await (async () => {
        await ensureSchema(sql);
        const rows = await sql`SELECT * FROM ai_mail_users WHERE id = ${id} LIMIT 1`;
        return rows[0] ? mapUser(rows[0]) : null;
      })())
    : demoUsers.find((item) => item.id === id) || null;
  if (!current) throw new Error("NOT_FOUND");

  const { password: newPassword, ...profileInput } = input;
  const next: ManagedUser = {
    ...current,
    ...profileInput,
    email: (input.email || current.email).toLowerCase(),
  };
  if (!sql) {
    demoUsers = demoUsers.map((item) => (item.id === id ? next : item));
  } else {
    const passwordHash = newPassword ? await hashPassword(newPassword) : null;
    await sql`
      UPDATE ai_mail_users SET
        name = ${next.name}, email = ${next.email}, title = ${next.title}, role = ${next.role},
        status = ${next.status},
        password_hash = CASE WHEN ${passwordHash}::text IS NULL THEN password_hash ELSE ${passwordHash} END,
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }
  const change = current.role !== next.role
    ? `Changed role to ${next.role.replaceAll("_", " ")}`
    : current.status !== next.status
      ? `Changed status to ${next.status}`
      : "Updated user";
  await addAudit(actor, change, next.name);
  return next;
}

export async function getSettings() {
  const sql = getClient();
  if (!sql) return { ...demoSettings };
  await ensureSchema(sql);
  const rows = await sql`SELECT * FROM ai_mail_settings WHERE id = 'default' LIMIT 1`;
  return rows[0] ? mapSettings(rows[0]) : { ...defaultSettings };
}

export async function updateSettings(input: AdminSettings, actor: SessionUser) {
  const sql = getClient();
  if (!sql) {
    demoSettings = { ...input };
  } else {
    await ensureSchema(sql);
    await sql`
      UPDATE ai_mail_settings SET
        organization_name = ${input.organizationName}, workspace_name = ${input.workspaceName},
        default_sender_name = ${input.defaultSenderName}, support_email = ${input.supportEmail},
        ai_model = ${input.aiModel}, ai_tone = ${input.aiTone},
        ai_auto_summarize = ${input.aiAutoSummarize}, ai_priority_detection = ${input.aiPriorityDetection},
        require_mfa = ${input.requireMfa}, session_timeout_minutes = ${input.sessionTimeoutMinutes},
        allow_demo_login = ${input.allowDemoLogin}, updated_at = NOW()
      WHERE id = 'default'
    `;
  }
  await addAudit(actor, "Updated workspace settings", input.workspaceName);
  return { ...input };
}

export type SaveAlertGroupInput = {
  name: string;
  description: string;
  color: AlertGroupColor;
  memberIds: string[];
  active: boolean;
};

export async function listAlertGroups(activeOnly = false) {
  const sql = getClient();
  if (!sql) {
    return demoAlertGroups
      .filter((group) => !activeOnly || group.active)
      .map((group) => ({ ...group, memberIds: [...group.memberIds] }));
  }
  await ensureSchema(sql);
  const rows = activeOnly
    ? await sql`SELECT * FROM ai_mail_alert_groups WHERE active = TRUE ORDER BY name ASC`
    : await sql`SELECT * FROM ai_mail_alert_groups ORDER BY active DESC, name ASC`;
  return rows.map((row) => mapAlertGroup(row));
}

export async function createAlertGroup(input: SaveAlertGroupInput, actor: SessionUser) {
  const group: AlertGroup = {
    id: crypto.randomUUID(),
    ...input,
    memberIds: [...new Set(input.memberIds)],
    createdAt: new Date().toISOString(),
  };
  const sql = getClient();
  if (!sql) {
    if (demoAlertGroups.some((item) => item.name.toLowerCase() === group.name.toLowerCase())) {
      throw new Error("GROUP_EXISTS");
    }
    demoAlertGroups = [...demoAlertGroups, group];
  } else {
    await ensureSchema(sql);
    try {
      await sql`
        INSERT INTO ai_mail_alert_groups (id, name, description, color, member_ids, active, created_at)
        VALUES (${group.id}, ${group.name}, ${group.description}, ${group.color}, ${JSON.stringify(group.memberIds)}::jsonb, ${group.active}, ${group.createdAt})
      `;
    } catch (error) {
      if (String(error).includes("unique")) throw new Error("GROUP_EXISTS");
      throw error;
    }
  }
  await addAudit(actor, "Created escalation group", group.name);
  return group;
}

export async function updateAlertGroup(id: string, input: SaveAlertGroupInput, actor: SessionUser) {
  const sql = getClient();
  const current = (await listAlertGroups()).find((group) => group.id === id);
  if (!current) throw new Error("NOT_FOUND");
  const group: AlertGroup = {
    ...current,
    ...input,
    memberIds: [...new Set(input.memberIds)],
  };
  if (!sql) {
    if (demoAlertGroups.some((item) => item.id !== id && item.name.toLowerCase() === group.name.toLowerCase())) {
      throw new Error("GROUP_EXISTS");
    }
    demoAlertGroups = demoAlertGroups.map((item) => item.id === id ? group : item);
  } else {
    try {
      await sql`
        UPDATE ai_mail_alert_groups SET
          name = ${group.name}, description = ${group.description}, color = ${group.color},
          member_ids = ${JSON.stringify(group.memberIds)}::jsonb, active = ${group.active}, updated_at = NOW()
        WHERE id = ${id}
      `;
    } catch (error) {
      if (String(error).includes("unique")) throw new Error("GROUP_EXISTS");
      throw error;
    }
  }
  await addAudit(actor, "Updated escalation group", group.name);
  return group;
}

export async function retireAlertGroup(id: string, actor: SessionUser) {
  const group = (await listAlertGroups()).find((item) => item.id === id);
  if (!group) throw new Error("NOT_FOUND");
  const sql = getClient();
  const retired = { ...group, active: false };
  if (!sql) {
    demoAlertGroups = demoAlertGroups.map((item) => item.id === id ? retired : item);
  } else {
    await sql`UPDATE ai_mail_alert_groups SET active = FALSE, updated_at = NOW() WHERE id = ${id}`;
  }
  await addAudit(actor, "Retired escalation group", group.name);
  return retired;
}

export async function addAudit(actor: SessionUser, action: string, target: string) {
  const event: AuditEvent = {
    id: crypto.randomUUID(),
    actorName: actor.name,
    action,
    target,
    createdAt: new Date().toISOString(),
  };
  const sql = getClient();
  if (!sql) {
    demoAudit = [event, ...demoAudit].slice(0, 100);
    return event;
  }
  await ensureSchema(sql);
  await sql`
    INSERT INTO ai_mail_audit_events (id, actor_id, actor_name, action, target, created_at)
    VALUES (${event.id}, ${actor.id}, ${event.actorName}, ${event.action}, ${event.target}, ${event.createdAt})
  `;
  return event;
}

export async function listAudit() {
  const sql = getClient();
  if (!sql) return demoAudit.map((event) => ({ ...event }));
  await ensureSchema(sql);
  const rows = await sql`SELECT * FROM ai_mail_audit_events ORDER BY created_at DESC LIMIT 100`;
  return rows.map((row) => ({
    id: String(row.id),
    actorName: String(row.actor_name),
    action: String(row.action),
    target: String(row.target),
    createdAt: iso(row.created_at) || new Date(0).toISOString(),
  }));
}
