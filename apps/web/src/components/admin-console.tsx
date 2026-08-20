"use client";

import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  Activity,
  ArrowLeft,
  BellRing,
  Bot,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MailCheck,
  Menu,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import type {
  AdminSettings,
  AlertGroup,
  AlertGroupColor,
  AppStatus,
  AuditEvent,
  ManagedUser,
  SessionUser,
  UserRole,
  UserStatus,
} from "@/lib/types";
import { webPath } from "@/lib/web-path";

type AdminSection = "overview" | "users" | "groups" | "roles" | "organization" | "services" | "audit";
type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
};

const navGroups: Array<{ label: string; items: Array<{ id: AdminSection; label: string; icon: Icon }> }> = [
  { label: "CONTROL CENTER", items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "users", label: "Users", icon: Users }, { id: "groups", label: "Alert groups", icon: UsersRound }, { id: "roles", label: "Roles & access", icon: ShieldCheck }] },
  { label: "CONFIGURATION", items: [{ id: "organization", label: "Organization", icon: Building2 }, { id: "services", label: "AI & mail", icon: SlidersHorizontal }, { id: "audit", label: "Audit log", icon: Activity }] },
];

const sectionMeta: Record<AdminSection, { eyebrow: string; title: string; detail: string }> = {
  overview: { eyebrow: "ADMIN CONSOLE", title: "Workspace overview", detail: "Identity, policy, and service health at a glance." },
  users: { eyebrow: "IDENTITY", title: "User management", detail: "Invite people and control their role and access status." },
  groups: { eyebrow: "ESCALATION", title: "Alert groups", detail: "Define the teams that can receive and own escalated alerts." },
  roles: { eyebrow: "GOVERNANCE", title: "Roles & access", detail: "Review exactly what each workspace role can do." },
  organization: { eyebrow: "WORKSPACE", title: "Organization settings", detail: "Configure identity, security, and session policy." },
  services: { eyebrow: "INTELLIGENCE", title: "AI & mail settings", detail: "Set the assistant policy and review private service connections." },
  audit: { eyebrow: "SECURITY", title: "Audit log", detail: "Trace administrative activity across the workspace." },
};

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function dateLabel(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function UserEditor({
  user,
  currentUser,
  onClose,
  onSave,
  onDelete,
  saving,
}: {
  user: ManagedUser | null;
  currentUser: SessionUser;
  onClose: () => void;
  onSave: (data: { name: string; email: string; title: string; role: UserRole; status: UserStatus; password?: string }) => void;
  onDelete: (() => void) | null;
  saving: boolean;
}) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [title, setTitle] = useState(user?.title || "");
  const [role, setRole] = useState<UserRole>(user?.role || "member");
  const [status, setStatus] = useState<UserStatus>(user?.status || "invited");
  const [password, setPassword] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ name, email, title, role, status, password: password || undefined });
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="user-editor" onSubmit={submit}>
        <header><div><p className="eyebrow">{user ? "EDIT IDENTITY" : "NEW IDENTITY"}</p><h2>{user ? "Manage user" : "Add a user"}</h2></div><button type="button" onClick={onClose} aria-label="Close user editor"><X size={19} /></button></header>
        <div className="user-editor-body">
          <div className="user-editor-intro"><span>{initials(name || "New User")}</span><div><strong>{name || "New workspace user"}</strong><small>{user ? "Update profile and access" : "Create an account or send an invitation"}</small></div></div>
          <div className="admin-form-grid">
            <label><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required /></label>
            <label><span>Work email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required /></label>
            <label className="field-wide"><span>Title or team</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Operations, Finance, Engineering…" /></label>
            <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as UserRole)} disabled={currentUser.role !== "super_admin" && (role === "admin" || role === "super_admin")}><option value="viewer">Viewer</option><option value="member">Member</option><option value="manager">Manager</option><option value="admin">Admin</option>{currentUser.role === "super_admin" ? <option value="super_admin">Super Admin</option> : null}</select></label>
            <label><span>Access status</span><select value={status} onChange={(event) => setStatus(event.target.value as UserStatus)}><option value="invited">Invited</option><option value="active">Active</option><option value="suspended">Suspended</option>{user?.status === "deleted" ? <option value="deleted">Deleted</option> : null}</select></label>
            <label className="field-wide"><span>{user ? "Reset password (optional)" : "Temporary password (optional)"}</span><input type="password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" /><small>Leave blank for an invitation-only account. Passwords are stored as salted scrypt hashes.</small></label>
          </div>
        </div>
        <footer>{onDelete ? <button type="button" className="danger-button" onClick={onDelete} disabled={saving}><Trash2 size={15} /> Remove user</button> : <span />}<div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <UserCheck size={15} />}{user ? "Save changes" : "Create user"}</button></div></footer>
      </form>
    </div>
  );
}

type AlertGroupInput = Pick<AlertGroup, "name" | "description" | "color" | "memberIds" | "active">;

function GroupEditor({
  group,
  users,
  onClose,
  onSave,
  onRetire,
  saving,
}: {
  group: AlertGroup | null;
  users: ManagedUser[];
  onClose: () => void;
  onSave: (data: AlertGroupInput) => void;
  onRetire: (() => void) | null;
  saving: boolean;
}) {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [color, setColor] = useState<AlertGroupColor>(group?.color || "blue");
  const [memberIds, setMemberIds] = useState<string[]>(group?.memberIds || []);
  const [active, setActive] = useState(group?.active ?? true);
  const availableUsers = users.filter((user) => user.status !== "deleted");

  function toggleMember(id: string) {
    setMemberIds((current) => current.includes(id)
      ? current.filter((memberId) => memberId !== id)
      : [...current, id]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ name, description, color, memberIds, active });
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="user-editor group-editor" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="group-editor-title">
        <header><div><p className="eyebrow">{group ? "EDIT ESCALATION GROUP" : "NEW ESCALATION GROUP"}</p><h2 id="group-editor-title">{group ? "Manage alert group" : "Create alert group"}</h2></div><button type="button" onClick={onClose} aria-label="Close group editor"><X size={19} /></button></header>
        <div className="user-editor-body">
          <div className={`group-editor-intro alert-group-color--${color}`}><span><UsersRound size={19} /></span><div><strong>{name || "New escalation group"}</strong><small>{memberIds.length} assigned member{memberIds.length === 1 ? "" : "s"}</small></div></div>
          <div className="admin-form-grid group-form-grid">
            <label><span>Group name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Legal & Compliance" maxLength={80} required /></label>
            <label><span>Group color</span><select value={color} onChange={(event) => setColor(event.target.value as AlertGroupColor)}><option value="blue">Blue</option><option value="violet">Violet</option><option value="amber">Amber</option><option value="red">Red</option><option value="green">Green</option></select></label>
            <label className="field-wide"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should be escalated to this group?" maxLength={240} rows={3} /></label>
            <label><span>Group status</span><select value={active ? "active" : "retired"} onChange={(event) => setActive(event.target.value === "active")}><option value="active">Active</option><option value="retired">Retired</option></select></label>
          </div>
          <fieldset className="group-member-picker"><legend>Assigned members</legend><p>Select the people who should receive alerts escalated to this group.</p><div>{availableUsers.map((user) => <label key={user.id}><input type="checkbox" checked={memberIds.includes(user.id)} onChange={() => toggleMember(user.id)} /><span>{initials(user.name)}</span><p><strong>{user.name}</strong><small>{user.title || roleLabels[user.role]}</small></p><Check size={14} /></label>)}</div></fieldset>
        </div>
        <footer>{onRetire ? <button type="button" className="danger-button" onClick={onRetire} disabled={saving || !group?.active}><Trash2 size={15} /> Retire group</button> : <span />}<div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{group ? "Save group" : "Create group"}</button></div></footer>
      </form>
    </div>
  );
}

function Overview({ users, groups, events, status, demo, onNavigate }: { users: ManagedUser[]; groups: AlertGroup[]; events: AuditEvent[]; status: AppStatus | null; demo: boolean; onNavigate: (section: AdminSection) => void }) {
  const active = users.filter((user) => user.status === "active").length;
  const admins = users.filter((user) => user.role === "admin" || user.role === "super_admin").length;
  const services = [status?.imap, status?.smtp, status?.openai, status?.database].filter(Boolean).length;
  return (
    <div className="admin-overview-grid">
      <section className="admin-welcome-card"><div><span><ShieldCheck size={15} /> GOVERNED WORKSPACE</span><h2>Your control plane is ready.</h2><p>{demo ? "Explore every administrative workflow with Bernie’s demo account. Changes are simulated until a database is connected." : "Identity, service, and policy changes are now stored in your connected database."}</p><button type="button" onClick={() => onNavigate("users")}>Manage users <ChevronRight size={15} /></button></div><div className="admin-health-ring"><strong>{services}/4</strong><small>services ready</small></div></section>
      <section className="admin-stat-grid">
        <article><span className="admin-stat-icon blue"><Users size={19} /></span><div><small>TOTAL USERS</small><strong>{users.length}</strong><em>{active} active</em></div></article>
        <article><span className="admin-stat-icon violet"><ShieldCheck size={19} /></span><div><small>ADMINISTRATORS</small><strong>{admins}</strong><em>Privileged accounts</em></div></article>
        <article><span className="admin-stat-icon green"><MailCheck size={19} /></span><div><small>SERVICES READY</small><strong>{services}</strong><em>of 4 configured</em></div></article>
        <article><span className="admin-stat-icon amber"><BellRing size={19} /></span><div><small>ALERT GROUPS</small><strong>{groups.filter((group) => group.active).length}</strong><em>{groups.length} defined</em></div></article>
      </section>
      <section className="admin-panel admin-member-panel"><header><div><p className="eyebrow">ACCESS SNAPSHOT</p><h3>Workspace members</h3></div><button onClick={() => onNavigate("users")}>View all <ChevronRight size={14} /></button></header><div>{users.slice(0, 5).map((user) => <button type="button" key={user.id} onClick={() => onNavigate("users")}><span className="admin-user-avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><em className={`role-badge role-badge--${user.role}`}>{roleLabels[user.role]}</em><i className={`status-dot status-dot--${user.status}`} /></button>)}</div></section>
      <section className="admin-panel admin-readiness"><header><div><p className="eyebrow">SYSTEM READINESS</p><h3>Private connections</h3></div><Settings size={17} /></header>{[{ label: "User database", ready: status?.database }, { label: "Incoming mail", ready: status?.imap }, { label: "Outgoing mail", ready: status?.smtp }, { label: "OpenAI intelligence", ready: status?.openai }].map((item) => <div key={item.label}><span className={item.ready ? "ready-check ready-check--on" : "ready-check"}>{item.ready ? <Check size={13} /> : <CircleAlert size={13} />}</span><strong>{item.label}</strong><em>{item.ready ? "Connected" : "Setup required"}</em></div>)}<button type="button" onClick={() => onNavigate("services")}>Open configuration</button></section>
      <section className="admin-panel admin-audit-preview"><header><div><p className="eyebrow">RECENT ACTIVITY</p><h3>Audit trail</h3></div><button onClick={() => onNavigate("audit")}>Full log <ChevronRight size={14} /></button></header>{events.slice(0, 4).map((event) => <div key={event.id}><span><Activity size={14} /></span><p><strong>{event.actorName}</strong> {event.action.toLowerCase()}<small>{event.target} · {dateLabel(event.createdAt)}</small></p></div>)}</section>
    </div>
  );
}

const permissions = [
  { label: "Read messages", roles: [true, true, true, true, true] },
  { label: "Compose and send", roles: [true, true, true, true, false] },
  { label: "Use AI assistance", roles: [true, true, true, true, false] },
  { label: "Escalate alerts", roles: [true, true, true, true, false] },
  { label: "Manage team workflows", roles: [true, true, true, false, false] },
  { label: "Manage escalation groups", roles: [true, true, false, false, false] },
  { label: "Manage users", roles: [true, true, false, false, false] },
  { label: "Assign administrator roles", roles: [true, false, false, false, false] },
  { label: "Configure security & services", roles: [true, true, false, false, false] },
];

export function AdminConsole({ initialUser }: { initialUser: SessionUser }) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [groups, setGroups] = useState<AlertGroup[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<ManagedUser | "new" | null>(null);
  const [groupEditor, setGroupEditor] = useState<AlertGroup | "new" | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [usersResponse, groupsResponse, settingsResponse, auditResponse, statusResponse] = await Promise.all([
        fetch(webPath("/api/admin/users"), { cache: "no-store" }),
        fetch(webPath("/api/admin/groups"), { cache: "no-store" }),
        fetch(webPath("/api/admin/settings"), { cache: "no-store" }),
        fetch(webPath("/api/admin/audit"), { cache: "no-store" }),
        fetch(webPath("/api/status"), { cache: "no-store" }),
      ]);
      if ([usersResponse, groupsResponse, settingsResponse, auditResponse, statusResponse].some((response) => !response.ok)) {
        setToast("The Admin Console could not load all workspace data.");
        setLoading(false);
        return;
      }
      const [userData, groupData, settingsData, auditData, statusData] = await Promise.all([usersResponse.json(), groupsResponse.json(), settingsResponse.json(), auditResponse.json(), statusResponse.json()]) as [{ users: ManagedUser[]; demo: boolean }, { groups: AlertGroup[]; demo: boolean }, { settings: AdminSettings; demo: boolean }, { events: AuditEvent[] }, AppStatus];
      setUsers(userData.users); setGroups(groupData.groups); setSettings(settingsData.settings); setEvents(auditData.events); setStatus(statusData); setDemo(userData.demo || groupData.demo || settingsData.demo); setLoading(false);
    }
    void load();
  }, []);

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 4200); return () => window.clearTimeout(timer); }, [toast]);

  const visibleUsers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      return !query || `${user.name} ${user.email} ${user.title} ${roleLabels[user.role]}`.toLowerCase().includes(query);
    });
  }, [deferredSearch, statusFilter, users]);

  async function refreshAudit() {
    const response = await fetch(webPath("/api/admin/audit"), { cache: "no-store" });
    if (response.ok) setEvents(((await response.json()) as { events: AuditEvent[] }).events);
  }

  async function saveUser(data: { name: string; email: string; title: string; role: UserRole; status: UserStatus; password?: string }) {
    setSaving(true);
    const creating = editor === "new";
    const response = await fetch(webPath(creating ? "/api/admin/users" : `/api/admin/users/${(editor as ManagedUser).id}`), { method: creating ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = (await response.json().catch(() => null)) as { user?: ManagedUser; error?: string } | null;
    if (!response.ok || !result?.user) { setToast(result?.error || "Unable to save the user."); setSaving(false); return; }
    setUsers((current) => creating ? [...current, result.user as ManagedUser] : current.map((user) => user.id === result.user?.id ? result.user : user) as ManagedUser[]);
    setToast(creating ? "User added to the workspace." : "User access updated."); setEditor(null); setSaving(false); void refreshAudit();
  }

  async function deleteUser() {
    if (!editor || editor === "new") return;
    if (!window.confirm(`Remove ${editor.name} from this workspace?`)) return;
    setSaving(true);
    const response = await fetch(webPath(`/api/admin/users/${editor.id}`), { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { user?: ManagedUser; error?: string } | null;
    if (!response.ok || !result?.user) { setToast(result?.error || "Unable to remove the user."); setSaving(false); return; }
    setUsers((current) => current.map((user) => user.id === result.user?.id ? result.user as ManagedUser : user)); setToast("User removed from active access."); setEditor(null); setSaving(false); void refreshAudit();
  }

  async function saveGroup(data: AlertGroupInput) {
    setSaving(true);
    const creating = groupEditor === "new";
    const endpoint = webPath(creating ? "/api/admin/groups" : `/api/admin/groups/${(groupEditor as AlertGroup).id}`);
    const response = await fetch(endpoint, { method: creating ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = (await response.json().catch(() => null)) as { group?: AlertGroup; error?: string } | null;
    if (!response.ok || !result?.group) { setToast(result?.error || "Unable to save the escalation group."); setSaving(false); return; }
    setGroups((current) => {
      const next = creating
        ? [...current, result.group as AlertGroup]
        : current.map((group) => group.id === result.group?.id ? result.group as AlertGroup : group);
      return next.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
    });
    setToast(creating ? "Escalation group created." : "Escalation group updated."); setGroupEditor(null); setSaving(false); void refreshAudit();
  }

  async function retireGroup() {
    if (!groupEditor || groupEditor === "new") return;
    if (!window.confirm(`Retire ${groupEditor.name}? It will no longer appear as an escalation target.`)) return;
    setSaving(true);
    const response = await fetch(webPath(`/api/admin/groups/${groupEditor.id}`), { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { group?: AlertGroup; error?: string } | null;
    if (!response.ok || !result?.group) { setToast(result?.error || "Unable to retire the escalation group."); setSaving(false); return; }
    setGroups((current) => current.map((group) => group.id === result.group?.id ? result.group as AlertGroup : group));
    setToast("Escalation group retired."); setGroupEditor(null); setSaving(false); void refreshAudit();
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    const response = await fetch(webPath("/api/admin/settings"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    const result = (await response.json().catch(() => null)) as { settings?: AdminSettings; error?: string } | null;
    if (!response.ok || !result?.settings) { setToast(result?.error || "Unable to save settings."); setSaving(false); return; }
    setSettings(result.settings); setToast(demo ? "Settings updated for this demo session." : "Workspace settings saved."); setSaving(false); void refreshAudit();
  }

  async function logout() { await fetch(webPath("/api/auth/logout"), { method: "POST" }); window.location.assign(webPath("/")); }
  const meta = sectionMeta[section];

  return (
    <main className="admin-shell">
      <aside className={mobileNav ? "admin-sidebar admin-sidebar--open" : "admin-sidebar"}>
        <button className="admin-sidebar-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button>
        <Link href={webPath("/inbox")} className="brand-lockup admin-brand"><span className="brand-mark" aria-hidden="true">r3</span><span><strong>r3alm</strong><small>ADMIN CONSOLE</small></span></Link>
        <nav>{navGroups.map((group) => <div key={group.label}><p>{group.label}</p>{group.items.map((item) => { const ItemIcon = item.icon; return <button key={item.id} className={section === item.id ? "active" : ""} type="button" onClick={() => { setSection(item.id); setMobileNav(false); }}><ItemIcon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === "users" ? <b>{users.length}</b> : item.id === "groups" ? <b>{groups.filter((alertGroup) => alertGroup.active).length}</b> : null}</button>; })}</div>)}</nav>
        <div className="admin-sidebar-bottom"><Link href={webPath("/inbox")}><ArrowLeft size={17} /> Back to AI-Mail</Link><button onClick={logout}><LogOut size={17} /> Sign out</button><div><span>{initials(initialUser.name)}</span><p><strong>{initialUser.name}</strong><small>{roleLabels[initialUser.role]}</small></p></div></div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar"><div><button className="admin-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button><span><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}</h1><small>{meta.detail}</small></span></div><div>{demo ? <span className="admin-demo-badge"><Database size={13} /> Demo workspace</span> : <span className="admin-live-badge"><Check size={13} /> Persistent</span>}<Link href={webPath("/inbox")} className="secondary-button"><MailCheck size={15} /> Open mail</Link></div></header>
        {demo ? <div className="admin-demo-banner"><CircleAlert size={16} /><span><strong>Simulation mode:</strong> user, group, and settings changes work in this preview but are not durable until `DATABASE_URL` is connected.</span></div> : null}
        <div className="admin-content">
          {loading ? <div className="admin-loading"><LoaderCircle className="spin" size={24} /><span>Loading workspace controls…</span></div> : null}
          {!loading && section === "overview" ? <Overview users={users} groups={groups} events={events} status={status} demo={demo} onNavigate={setSection} /> : null}
          {!loading && section === "users" ? <section className="admin-users-page"><div className="admin-page-actions"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, roles, or email" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option><option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option><option value="deleted">Deleted</option></select><button className="primary-button" onClick={() => setEditor("new")}><Plus size={16} /> Add user</button></div><div className="admin-table-wrap"><table className="admin-user-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Added</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user.id}><td><button className="user-name-cell" onClick={() => setEditor(user)}><span>{initials(user.name)}</span><p><strong>{user.name}</strong><small>{user.email} · {user.title || "No title"}</small></p></button></td><td><span className={`role-badge role-badge--${user.role}`}>{roleLabels[user.role]}</span></td><td><span className={`status-badge status-badge--${user.status}`}><i />{user.status}</span></td><td>{dateLabel(user.lastLoginAt)}</td><td>{dateLabel(user.createdAt)}</td><td><button className="row-menu" onClick={() => setEditor(user)} aria-label={`Manage ${user.name}`}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{visibleUsers.length === 0 ? <div className="admin-empty"><Users size={23} /><strong>No users found</strong><span>Try a different search or status filter.</span></div> : null}</div><p className="admin-table-footnote">{visibleUsers.length} of {users.length} users shown · Deleted users cannot sign in.</p></section> : null}
          {!loading && section === "groups" ? (
            <section className="admin-groups-page">
              <div className="admin-page-actions group-page-actions"><div><BellRing size={17} /><span><strong>{groups.filter((group) => group.active).length} active groups</strong><small>Available from every expanded alert.</small></span></div><button className="primary-button" type="button" onClick={() => setGroupEditor("new")}><Plus size={16} /> Create group</button></div>
              <div className="groups-intro"><span><UsersRound size={21} /></span><div><h2>Route alerts to the right team</h2><p>Groups define who receives an escalation. Retiring a group preserves its configuration while removing it from the Alert Center.</p></div></div>
              <div className="alert-group-grid">
                {groups.map((group) => {
                  const members = group.memberIds.map((id) => users.find((user) => user.id === id)).filter((user): user is ManagedUser => Boolean(user));
                  return <article className={group.active ? "alert-group-card" : "alert-group-card alert-group-card--retired"} key={group.id}><header><span className={`alert-group-card-icon alert-group-color--${group.color}`}><UsersRound size={18} /></span><div><h3>{group.name}</h3><span className={group.active ? "group-status group-status--active" : "group-status"}>{group.active ? "Active" : "Retired"}</span></div><button type="button" className="row-menu" onClick={() => setGroupEditor(group)} aria-label={`Manage ${group.name}`}><MoreHorizontal size={17} /></button></header><p>{group.description || "No escalation guidance has been added."}</p><footer><div className="group-member-stack">{members.slice(0, 4).map((member) => <span key={member.id} title={member.name}>{initials(member.name)}</span>)}{members.length > 4 ? <b>+{members.length - 4}</b> : null}{members.length === 0 ? <em>No members</em> : null}</div><button type="button" onClick={() => setGroupEditor(group)}>Configure <ChevronRight size={14} /></button></footer></article>;
                })}
              </div>
              {groups.length === 0 ? <div className="admin-empty group-empty"><UsersRound size={25} /><strong>No escalation groups defined</strong><span>Create the first group to enable alert escalation.</span></div> : null}
            </section>
          ) : null}
          {!loading && section === "roles" ? <section className="roles-page"><div className="roles-intro"><span><KeyRound size={21} /></span><div><h2>Principle of least privilege</h2><p>Roles grant a predictable set of workspace abilities. Super Admin is the only role that can assign or manage privileged administrators.</p></div></div><div className="permission-table-wrap"><table className="permission-table"><thead><tr><th>Capability</th>{Object.values(roleLabels).map((role) => <th key={role}>{role}</th>)}</tr></thead><tbody>{permissions.map((permission) => <tr key={permission.label}><td>{permission.label}</td>{permission.roles.map((allowed, index) => <td key={`${permission.label}-${index}`}>{allowed ? <span className="permission-yes"><Check size={14} /></span> : <span className="permission-no">—</span>}</td>)}</tr>)}</tbody></table></div><div className="role-cards">{Object.entries(roleLabels).map(([role, label], index) => <article key={role}><span className={`role-number role-number--${role}`}>{index + 1}</span><h3>{label}</h3><p>{["Owns all security, identity, and workspace controls.", "Manages users, policies, and operational configuration.", "Coordinates team workflows without changing system access.", "Works with mail and AI assistance in the assigned workspace.", "Reviews permitted mail and reports without making changes."][index]}</p><b>{users.filter((user) => user.role === role).length} assigned</b></article>)}</div></section> : null}
          {!loading && (section === "organization" || section === "services") && settings ? <section className="admin-settings-page"><div className="settings-section-grid">{section === "organization" ? <><div className="admin-panel settings-form-card"><header><span><Building2 size={18} /></span><div><h3>Organization profile</h3><p>Names shown throughout the workspace.</p></div></header><div className="admin-form-grid"><label><span>Organization name</span><input value={settings.organizationName} onChange={(event) => setSettings({ ...settings, organizationName: event.target.value })} /></label><label><span>Workspace name</span><input value={settings.workspaceName} onChange={(event) => setSettings({ ...settings, workspaceName: event.target.value })} /></label><label><span>Default sender name</span><input value={settings.defaultSenderName} onChange={(event) => setSettings({ ...settings, defaultSenderName: event.target.value })} /></label><label><span>Support email</span><input type="email" value={settings.supportEmail} onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })} /></label></div></div><div className="admin-panel settings-form-card"><header><span><ShieldCheck size={18} /></span><div><h3>Access policy</h3><p>Session and workspace authentication controls.</p></div></header><div className="setting-row"><div><strong>Require multi-factor authentication</strong><small>Policy flag for the production identity provider.</small></div><button className={settings.requireMfa ? "toggle toggle--active" : "toggle"} onClick={() => setSettings({ ...settings, requireMfa: !settings.requireMfa })} aria-pressed={settings.requireMfa}><span /></button></div><div className="setting-row"><div><strong>Allow demo login</strong><small>Keep disabled on the production environment.</small></div><button className={settings.allowDemoLogin ? "toggle toggle--active" : "toggle"} onClick={() => setSettings({ ...settings, allowDemoLogin: !settings.allowDemoLogin })} aria-pressed={settings.allowDemoLogin}><span /></button></div><label className="settings-select"><span>Session timeout</span><select value={settings.sessionTimeoutMinutes} onChange={(event) => setSettings({ ...settings, sessionTimeoutMinutes: Number(event.target.value) })}><option value={60}>1 hour</option><option value={240}>4 hours</option><option value={720}>12 hours</option><option value={1440}>24 hours</option><option value={10080}>7 days</option></select></label></div></> : <><div className="admin-panel settings-form-card"><header><span><Bot size={18} /></span><div><h3>OpenAI policy</h3><p>Assistant defaults for mail intelligence.</p></div></header><div className="admin-form-grid"><label><span>Preferred model</span><input value={settings.aiModel} onChange={(event) => setSettings({ ...settings, aiModel: event.target.value })} /></label><label><span>Response style</span><select value={settings.aiTone} onChange={(event) => setSettings({ ...settings, aiTone: event.target.value as AdminSettings["aiTone"] })}><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></label></div><div className="setting-row"><div><strong>Automatic summaries</strong><small>Prepare a brief for longer incoming messages.</small></div><button className={settings.aiAutoSummarize ? "toggle toggle--active" : "toggle"} onClick={() => setSettings({ ...settings, aiAutoSummarize: !settings.aiAutoSummarize })} aria-pressed={settings.aiAutoSummarize}><span /></button></div><div className="setting-row"><div><strong>Priority detection</strong><small>Elevate deadlines, risks, and direct requests.</small></div><button className={settings.aiPriorityDetection ? "toggle toggle--active" : "toggle"} onClick={() => setSettings({ ...settings, aiPriorityDetection: !settings.aiPriorityDetection })} aria-pressed={settings.aiPriorityDetection}><span /></button></div></div><div className="admin-panel service-config-card"><header><span><MailCheck size={18} /></span><div><h3>Private services</h3><p>Credentials are configured only in Vercel environment variables.</p></div></header>{[{ icon: Database, label: "User database", detail: "DATABASE_URL", ready: status?.database }, { icon: MailCheck, label: "Incoming mail", detail: "IMAP_* variables", ready: status?.imap }, { icon: MailCheck, label: "Outgoing mail", detail: "SMTP_* variables", ready: status?.smtp }, { icon: Bot, label: "OpenAI", detail: "OPENAI_API_KEY", ready: status?.openai }].map((service) => { const ServiceIcon = service.icon; return <div className="service-config-row" key={service.label}><span><ServiceIcon size={17} /></span><p><strong>{service.label}</strong><small>{service.detail}</small></p><em className={service.ready ? "ready" : ""}>{service.ready ? "Configured" : "Required"}</em></div>; })}<p className="service-secret-note"><ShieldCheck size={14} /> Secret values never enter browser state or Admin Console responses.</p></div></>}</div><div className="settings-save-bar"><span>{demo ? "Changes are simulated in this preview." : "Changes are stored in the workspace database."}</span><button className="primary-button" onClick={() => void saveSettings()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Save settings</button></div></section> : null}
          {!loading && section === "audit" ? <section className="audit-page"><div className="audit-summary"><span><Activity size={20} /></span><div><h2>Administrative activity</h2><p>Immutable-style records of identity, access, and configuration changes.</p></div><b>{events.length} events</b></div><div className="admin-panel audit-list">{events.map((event) => <article key={event.id}><span><Activity size={15} /></span><div><strong>{event.action}</strong><p><b>{event.actorName}</b> · {event.target}</p></div><time><Clock3 size={13} /> {dateLabel(event.createdAt)}</time></article>)}</div></section> : null}
        </div>
      </div>
      {editor ? <UserEditor key={editor === "new" ? "new" : editor.id} user={editor === "new" ? null : editor} currentUser={initialUser} onClose={() => setEditor(null)} onSave={(data) => void saveUser(data)} onDelete={editor !== "new" && editor.id !== initialUser.id ? () => void deleteUser() : null} saving={saving} /> : null}
      {groupEditor ? <GroupEditor key={groupEditor === "new" ? "new" : groupEditor.id} group={groupEditor === "new" ? null : groupEditor} users={users} onClose={() => setGroupEditor(null)} onSave={(data) => void saveGroup(data)} onRetire={groupEditor !== "new" ? () => void retireGroup() : null} saving={saving} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}
