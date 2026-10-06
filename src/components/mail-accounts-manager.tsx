"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, MailPlus, Pencil, Plus, Server, Trash2, X } from "lucide-react";
import type { MailAccountSummary } from "@/lib/types";
import { webPath } from "@/lib/web-path";

type AccountPayload = {
  label: string;
  email: string;
  active: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPassword?: string;
  sentFolder: string;
  archiveFolder: string;
  smtpEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpFrom?: string;
  smtpPassword?: string;
};

type AccountDetails = MailAccountSummary & {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  sentFolder: string;
  archiveFolder: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
};

const initialForm = {
  label: "",
  email: "",
  active: true,
  imapHost: "mail.r3alm.com",
  imapPort: "993",
  imapSecure: true,
  imapUser: "",
  imapPassword: "",
  sentFolder: "INBOX.Sent",
  archiveFolder: "Archive",
  smtpEnabled: true,
  smtpHost: "mail.r3alm.com",
  smtpPort: "465",
  smtpSecure: true,
  smtpUser: "",
  smtpFrom: "",
  smtpPassword: "",
};

export function MailAccountsManager({ onAccountsChanged }: { onAccountsChanged?: () => void | Promise<void> } = {}) {
  const [accounts, setAccounts] = useState<MailAccountSummary[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState("");
  const [deleting, setDeleting] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAccounts() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(webPath("/api/mail-accounts"), { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { accounts?: MailAccountSummary[]; canManage?: boolean; error?: string } | null;
      if (!response.ok || !payload?.accounts) throw new Error(payload?.error || "Unable to load connected mail accounts.");
      setAccounts(payload.accounts);
      setCanManage(Boolean(payload.canManage));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load connected mail accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAccounts(); }, []);

  function setField<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "email" && typeof value === "string") {
        if (!current.imapUser || current.imapUser === current.email) next.imapUser = value;
        if (!current.smtpUser || current.smtpUser === current.email) next.smtpUser = value;
        if (!current.smtpFrom || current.smtpFrom === current.email) next.smtpFrom = value;
      }
      if (key === "imapHost" && typeof value === "string" && current.smtpHost === current.imapHost) next.smtpHost = value;
      return next;
    });
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setEditingId(null);
    setEditorLoading(false);
    setForm(initialForm);
  }

  function openCreate() {
    setEditingId(null);
    setForm(initialForm);
    setError("");
    setMessage("");
    setEditorOpen(true);
  }

  async function openEdit(account: MailAccountSummary) {
    if (!canManage || saving || editorLoading) return;
    setEditingId(account.id);
    setEditorOpen(true);
    setEditorLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(webPath("/api/mail-accounts/" + encodeURIComponent(account.id)), { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { account?: AccountDetails; error?: string } | null;
      if (!response.ok || !payload?.account) throw new Error(payload?.error || "Unable to load the mail account settings.");
      const current = payload.account;
      setForm({
        label: current.label,
        email: current.email,
        active: current.primary ? true : current.active,
        imapHost: current.imapHost,
        imapPort: String(current.imapPort),
        imapSecure: current.imapSecure,
        imapUser: current.imapUser,
        imapPassword: "",
        sentFolder: current.sentFolder,
        archiveFolder: current.archiveFolder,
        smtpEnabled: current.smtpEnabled,
        smtpHost: current.smtpHost,
        smtpPort: String(current.smtpPort || 465),
        smtpSecure: current.smtpSecure,
        smtpUser: current.smtpUser,
        smtpFrom: current.smtpFrom,
        smtpPassword: "",
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the mail account settings.");
      setEditorOpen(false);
      setEditingId(null);
    } finally {
      setEditorLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || editorLoading) return;
    if (!editingId && !form.imapPassword) {
      setError("An IMAP password is required when adding a new account.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const body: AccountPayload = {
        label: form.label.trim(),
        email: form.email.trim(),
        active: editingId === "primary" ? true : form.active,
        imapHost: form.imapHost.trim(),
        imapPort: Number(form.imapPort),
        imapSecure: form.imapSecure,
        imapUser: form.imapUser.trim(),
        ...(form.imapPassword ? { imapPassword: form.imapPassword } : {}),
        sentFolder: form.sentFolder.trim(),
        archiveFolder: form.archiveFolder.trim(),
        smtpEnabled: form.smtpEnabled,
        ...(form.smtpEnabled ? {
          smtpHost: form.smtpHost.trim(),
          smtpPort: Number(form.smtpPort),
          smtpSecure: form.smtpSecure,
          smtpUser: form.smtpUser.trim(),
          smtpFrom: form.smtpFrom.trim(),
          ...(form.smtpPassword ? { smtpPassword: form.smtpPassword } : {}),
        } : {}),
      };

      const editing = Boolean(editingId);
      const response = await fetch(
        editing
          ? webPath("/api/mail-accounts/" + encodeURIComponent(editingId!))
          : webPath("/api/mail-accounts"),
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => null)) as { account?: MailAccountSummary; error?: string } | null;
      if (!response.ok || !payload?.account) {
        throw new Error(payload?.error || (editing ? "Unable to update the mail account." : "Unable to add the mail account."));
      }

      const saved = payload.account;
      setEditorOpen(false);
      setEditingId(null);
      setEditorLoading(false);
      setForm(initialForm);
      setMessage(
        editing
          ? saved.label + " was updated. Mailbox monitoring and research will use the new settings immediately."
          : saved.label + " was added. Inbox, Sent, Compose, and S.I. Mail Research can now use it.",
      );
      await loadAccounts();
      await onAccountsChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (editingId ? "Unable to update the mail account." : "Unable to add the mail account."));
    } finally {
      setSaving(false);
    }
  }

  async function testAccount(account: MailAccountSummary, service: "imap" | "smtp") {
    const key = account.id + ":" + service;
    setTesting(key);
    setError("");
    setMessage("");
    try {
      const response = await fetch(webPath("/api/mail-accounts/" + encodeURIComponent(account.id) + "/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Connection test failed.");
      setMessage(account.label + " " + service.toUpperCase() + " connection verified.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connection test failed.");
    } finally {
      setTesting("");
    }
  }

  async function removeAccount(account: MailAccountSummary) {
    if (account.primary || deleting) return;
    if (!window.confirm("Remove " + account.label + " from S.I.-Mail? Messages stay on the mail server, but this account will no longer be monitored.")) return;
    setDeleting(account.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(webPath("/api/mail-accounts/" + encodeURIComponent(account.id)), { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to remove the mail account.");
      if (editingId === account.id) closeEditor();
      setMessage(account.label + " was removed from S.I.-Mail.");
      await loadAccounts();
      await onAccountsChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to remove the mail account.");
    } finally {
      setDeleting("");
    }
  }

  const editingPrimary = editingId === "primary";
  const editorTitle = editingId ? "Edit mail account" : "Add mail account";
  const editorDescription = editingId
    ? "Update connection settings. Leave password fields blank to keep the existing Vault secrets."
    : "Passwords are stored server-side in Supabase Vault and are never returned to the browser.";

  return (
    <section className="mail-accounts-manager">
      <header>
        <div>
          <p className="eyebrow">MULTI-ACCOUNT MONITORING</p>
          <h3>Connected mailboxes</h3>
          <span>Monitor accounts together in one mailbox, or switch to any account individually.</span>
        </div>
        {canManage ? <button type="button" className="primary-button" onClick={openCreate}><Plus size={15} /> Add account</button> : null}
      </header>

      {message ? <p className="mail-account-message" role="status">{message}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {editorOpen ? (
        <form className="mail-account-editor" onSubmit={submit}>
          <div className="mail-account-editor-heading">
            <span>{editingId ? <Pencil size={19} /> : <MailPlus size={20} />}</span>
            <div><strong>{editorTitle}</strong><small>{editorDescription}</small></div>
            <button type="button" className="icon-button" aria-label="Close mail account editor" onClick={closeEditor} disabled={saving}><X size={16} /></button>
          </div>

          {editorLoading ? (
            <div className="mail-account-loading"><LoaderCircle className="spin" size={18} /> Loading account settings…</div>
          ) : (
            <>
              <div className="mail-account-form-grid">
                <label><span>Account label</span><input value={form.label} onChange={(e) => setField("label", e.target.value)} placeholder="e.g. Investor Relations" required disabled={editingPrimary} /></label>
                <label><span>Email address</span><input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required /></label>

                {!editingPrimary ? (
                  <label className="mail-account-checkbox mail-account-monitor-toggle">
                    <input type="checkbox" checked={form.active} onChange={(e) => setField("active", e.target.checked)} />
                    <span>Monitor this account</span>
                  </label>
                ) : null}

                <div className="mail-account-form-section"><strong>Incoming mail (IMAP)</strong><small>Used for Inbox, Sent, message actions, and S.I. research.</small></div>
                <label><span>IMAP host</span><input value={form.imapHost} onChange={(e) => setField("imapHost", e.target.value)} required /></label>
                <label><span>IMAP port</span><input type="number" min="1" max="65535" value={form.imapPort} onChange={(e) => setField("imapPort", e.target.value)} required /></label>
                <label><span>IMAP username</span><input value={form.imapUser} onChange={(e) => setField("imapUser", e.target.value)} required /></label>
                <label>
                  <span>IMAP password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.imapPassword}
                    onChange={(e) => setField("imapPassword", e.target.value)}
                    required={!editingId}
                    placeholder={editingId ? "Leave blank to keep current password" : ""}
                  />
                </label>
                <label><span>Sent folder</span><input value={form.sentFolder} onChange={(e) => setField("sentFolder", e.target.value)} required /></label>
                <label><span>Archive folder</span><input value={form.archiveFolder} onChange={(e) => setField("archiveFolder", e.target.value)} required /></label>
                <label className="mail-account-checkbox"><input type="checkbox" checked={form.imapSecure} onChange={(e) => setField("imapSecure", e.target.checked)} /><span>Use TLS for IMAP</span></label>

                <div className="mail-account-form-section">
                  <strong>Outgoing mail (SMTP)</strong>
                  <small>Enable it if this account should appear in Compose.</small>
                  <label className="mail-account-switch">
                    <input
                      type="checkbox"
                      checked={form.smtpEnabled}
                      onChange={(e) => setField("smtpEnabled", e.target.checked)}
                      disabled={editingPrimary}
                    />
                    <span>Enable sending</span>
                  </label>
                </div>
                {form.smtpEnabled ? (
                  <>
                    <label><span>SMTP host</span><input value={form.smtpHost} onChange={(e) => setField("smtpHost", e.target.value)} required /></label>
                    <label><span>SMTP port</span><input type="number" min="1" max="65535" value={form.smtpPort} onChange={(e) => setField("smtpPort", e.target.value)} required /></label>
                    <label><span>SMTP username</span><input value={form.smtpUser} onChange={(e) => setField("smtpUser", e.target.value)} required /></label>
                    <label><span>From address</span><input type="email" value={form.smtpFrom} onChange={(e) => setField("smtpFrom", e.target.value)} required /></label>
                    <label>
                      <span>SMTP password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={form.smtpPassword}
                        onChange={(e) => setField("smtpPassword", e.target.value)}
                        placeholder={editingId ? "Leave blank to keep current password" : "Leave blank to use IMAP password"}
                      />
                    </label>
                    <label className="mail-account-checkbox"><input type="checkbox" checked={form.smtpSecure} onChange={(e) => setField("smtpSecure", e.target.checked)} /><span>Use TLS for SMTP</span></label>
                  </>
                ) : null}
              </div>
              <footer>
                <button type="button" className="secondary-button" onClick={closeEditor} disabled={saving}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? <LoaderCircle className="spin" size={15} /> : editingId ? <Pencil size={14} /> : <Plus size={15} />}
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add mail account"}
                </button>
              </footer>
            </>
          )}
        </form>
      ) : null}

      <div className="mail-account-grid">
        {loading ? <div className="mail-account-loading"><LoaderCircle className="spin" size={18} /> Loading mail accounts…</div> : null}
        {!loading && accounts.map((account) => (
          <article className="mail-account-card" key={account.id}>
            <div className="mail-account-card-icon"><Server size={19} /></div>
            <div className="mail-account-card-copy">
              <span><strong>{account.label}</strong>{account.primary ? <b>Primary</b> : null}</span>
              <small>{account.email}</small>
            </div>
            <span className={account.active && account.imapReady ? "connection-state connection-state--ready" : "connection-state"}>
              {account.active && account.imapReady ? "Monitoring" : account.active ? "Needs setup" : "Paused"}
            </span>
            <dl>
              <div><dt>Incoming</dt><dd>{account.imapReady ? <><CheckCircle2 size={12} /> IMAP ready</> : "IMAP unavailable"}</dd></div>
              <div><dt>Outgoing</dt><dd>{account.smtpReady ? <><CheckCircle2 size={12} /> SMTP ready</> : "Read only"}</dd></div>
              <div><dt>Research</dt><dd>{account.active && account.imapReady ? "Included in All accounts" : "Excluded"}</dd></div>
            </dl>
            <footer>
              {canManage ? <button type="button" className="secondary-button mail-account-edit" onClick={() => void openEdit(account)} disabled={saving || editorLoading}><Pencil size={13} /> Edit</button> : null}
              {canManage ? <button type="button" className="secondary-button" onClick={() => void testAccount(account, "imap")} disabled={Boolean(testing)}>{testing === account.id + ":imap" ? <LoaderCircle className="spin" size={13} /> : null}Test IMAP</button> : null}
              {canManage && account.smtpReady ? <button type="button" className="secondary-button" onClick={() => void testAccount(account, "smtp")} disabled={Boolean(testing)}>{testing === account.id + ":smtp" ? <LoaderCircle className="spin" size={13} /> : null}Test SMTP</button> : null}
              {canManage && !account.primary ? <button type="button" className="mail-account-delete" onClick={() => void removeAccount(account)} disabled={Boolean(deleting)} aria-label={"Remove " + account.label}><Trash2 size={14} />{deleting === account.id ? "Removing…" : "Remove"}</button> : null}
              {account.primary ? <span>Primary mailbox cannot be removed.</span> : null}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
