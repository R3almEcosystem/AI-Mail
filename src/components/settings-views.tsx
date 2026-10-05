"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Bot,
  Check,
  ChevronRight,
  Database,
  KeyRound,
  MailCheck,
  Network,
  LoaderCircle,
  Pencil,
  Save,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { AiRule, AppStatus } from "@/lib/types";
import { webPath } from "@/lib/web-path";
import { MailAccountsManager } from "@/components/mail-accounts-manager";

function StatusRow({ label, detail, ready }: { label: string; detail: string; ready: boolean }) {
  return (
    <div className="status-row">
      <span className={ready ? "status-check status-check--ready" : "status-check"}>{ready ? <Check size={14} /> : <span />}</span>
      <span><strong>{label}</strong><small>{detail}</small></span>
      <b className={ready ? "status-text status-text--ready" : "status-text"}>{ready ? "Configured" : "Required"}</b>
    </div>
  );
}

export function AccountsView({ status }: { status: AppStatus | null }) {
  return (
    <div className="settings-page">
      <div className="settings-intro"><p className="eyebrow">CONNECTIONS</p><h2>Mail accounts</h2><p>Manage the server-side services that power AI-Mail.</p></div>
      <div className="connection-grid">
        <section className="connection-card">
          <span className="connection-icon connection-icon--blue"><MailCheck size={21} /></span>
          <div><h3>Incoming mail</h3><p>IMAP mailbox synchronization</p></div>
          <span className={status?.imap ? "connection-state connection-state--ready" : "connection-state"}>{status?.imap ? "Ready" : "Setup"}</span>
          <dl><div><dt>Protocol</dt><dd>IMAP over TLS</dd></div><div><dt>Folder</dt><dd>INBOX</dd></div><div><dt>Credentials</dt><dd>Vercel encrypted env</dd></div></dl>
        </section>
        <section className="connection-card">
          <span className="connection-icon connection-icon--green"><Network size={21} /></span>
          <div><h3>Outgoing mail</h3><p>SMTP delivery service</p></div>
          <span className={status?.smtp ? "connection-state connection-state--ready" : "connection-state"}>{status?.smtp ? "Ready" : "Setup"}</span>
          <dl><div><dt>Protocol</dt><dd>SMTP over TLS</dd></div><div><dt>Sender</dt><dd>Server controlled</dd></div><div><dt>Credentials</dt><dd>Vercel encrypted env</dd></div></dl>
        </section>
        <section className="connection-card">
          <span className="connection-icon connection-icon--violet"><Sparkles size={21} /></span>
          <div><h3>OpenAI</h3><p>Executive mail intelligence</p></div>
          <span className={status?.openai ? "connection-state connection-state--ready" : "connection-state"}>{status?.openai ? "Ready" : "Setup"}</span>
          <dl><div><dt>Provider</dt><dd>OpenAI API</dd></div><div><dt>Model</dt><dd>{status?.model || "Not selected"}</dd></div><div><dt>Key storage</dt><dd>Server only</dd></div></dl>
        </section>
      </div>
      <MailAccountsManager />
      <section className="panel configuration-panel">
        <div className="panel-heading"><div><p className="eyebrow">READINESS</p><h3>Configuration checklist</h3></div><span className="configuration-score">{[status?.imap, status?.smtp, status?.openai, status?.authentication].filter(Boolean).length}/4</span></div>
        <StatusRow ready={Boolean(status?.imap)} label="Incoming mailbox" detail="At least one active IMAP account is available for Inbox, Sent, and research." />
        <StatusRow ready={Boolean(status?.smtp)} label="Outbound delivery" detail="At least one connected account can send through SMTP." />
        <StatusRow ready={Boolean(status?.openai)} label="OpenAI intelligence" detail="OPENAI_API_KEY and OPENAI_MODEL" />
        <StatusRow ready={Boolean(status?.authentication || status?.demoLogin)} label="Console authentication" detail="Signed user sessions and role-based access" />
      </section>
    </div>
  );
}

function ruleMatchSummary(rule: AiRule) {
  const parts: string[] = [];
  if (rule.senderDomains.length) parts.push(`sender: ${rule.senderDomains.join(", ")}`);
  if (rule.senderAddresses.length) parts.push(`from: ${rule.senderAddresses.join(", ")}`);
  if (rule.subjectPrefixes.length) parts.push(`subject starts: ${rule.subjectPrefixes.join(", ")}`);
  if (rule.subjectTerms.length) parts.push(`subject: ${rule.subjectTerms.slice(0, 3).join(", ")}`);
  if (rule.bodyTerms.length) parts.push(`body: ${rule.bodyTerms.slice(0, 3).join(", ")}`);
  if (rule.requireReply) parts.push("reply/thread response");
  return parts.slice(0, 3).join(" · ");
}

function listText(values: string[]) {
  return values.join("\n");
}

function parseList(value: string): string[] {
  return [...new Set(value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))];
}

function AiRuleEditor({
  rule,
  saving,
  onClose,
  onSave,
}: {
  rule: AiRule;
  saving: boolean;
  onClose: () => void;
  onSave: (rule: AiRule) => void;
}) {
  const [draft, setDraft] = useState(rule);
  const [senderDomains, setSenderDomains] = useState(listText(rule.senderDomains));
  const [senderAddresses, setSenderAddresses] = useState(listText(rule.senderAddresses));
  const [recipientTerms, setRecipientTerms] = useState(listText(rule.recipientTerms));
  const [subjectTerms, setSubjectTerms] = useState(listText(rule.subjectTerms));
  const [bodyTerms, setBodyTerms] = useState(listText(rule.bodyTerms));
  const [subjectPrefixes, setSubjectPrefixes] = useState(listText(rule.subjectPrefixes));

  function setAction(key: keyof AiRule["actions"], value: boolean) {
    setDraft((current) => ({ ...current, actions: { ...current.actions, [key]: value } }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      ...draft,
      senderDomains: parseList(senderDomains),
      senderAddresses: parseList(senderAddresses),
      recipientTerms: parseList(recipientTerms),
      subjectTerms: parseList(subjectTerms),
      bodyTerms: parseList(bodyTerms),
      subjectPrefixes: parseList(subjectPrefixes),
    });
  }

  const actions: Array<{ key: keyof AiRule["actions"]; label: string; detail: string }> = [
    { key: "autoSummary", label: "Automatic summary", detail: "Prepare a brief when the rule matches." },
    { key: "suggestReply", label: "Suggest reply", detail: "Surface a draft-reply recommendation." },
    { key: "extractActions", label: "Extract actions", detail: "Identify tasks, owners, and next steps." },
    { key: "extractDeadline", label: "Extract deadline", detail: "Look for due dates and timing commitments." },
    { key: "escalate", label: "Escalate", detail: "Mark the message for heightened attention." },
    { key: "sentiment", label: "Sentiment analysis", detail: "Include tone/sentiment analysis when relevant." },
    { key: "compress", label: "Compress", detail: "Prefer a shortened executive representation." },
    { key: "sensitive", label: "Sensitive", detail: "Treat matches as sensitive content." },
  ];

  return (
    <div className="rule-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form className="rule-editor-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="rule-editor-title">
        <header>
          <div><p className="eyebrow">AI RULE GOVERNANCE</p><h2 id="rule-editor-title">Edit rule</h2><span>{rule.system ? "System rule" : "Workspace rule"} · {rule.id}</span></div>
          <button type="button" className="icon-button" aria-label="Close AI rule editor" onClick={onClose} disabled={saving}><X size={17} /></button>
        </header>

        <div className="rule-editor-scroll">
          <section className="rule-editor-section">
            <div className="rule-editor-section-heading"><strong>Identity & behavior</strong><small>Human-readable rule metadata and base classification.</small></div>
            <div className="rule-editor-grid">
              <label className="field-wide"><span>Rule name</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={120} required /></label>
              <label className="field-wide"><span>Description</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} rows={3} /></label>
              <label><span>Category</span><input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} maxLength={80} required /></label>
              <label><span>Priority</span><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as AiRule["priority"] })}><option value="urgent">Urgent</option><option value="important">Important</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
              <label><span>Direction</span><select value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value as AiRule["direction"] })}><option value="both">Inbound & outbound</option><option value="inbound">Inbound only</option><option value="outbound">Outbound only</option></select></label>
              <label className="rule-editor-checkbox"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span><strong>Rule enabled</strong><small>Apply this rule during live classification.</small></span></label>
              <label className="rule-editor-checkbox field-wide"><input type="checkbox" checked={draft.requireReply} onChange={(event) => setDraft({ ...draft, requireReply: event.target.checked })} /><span><strong>Require reply/thread context</strong><small>Only match messages that are replies or forwards.</small></span></label>
            </div>
          </section>

          <section className="rule-editor-section">
            <div className="rule-editor-section-heading"><strong>Match conditions</strong><small>Enter one value per line or separate values with commas. Empty fields do not restrict matching.</small></div>
            <div className="rule-editor-grid rule-editor-grid--criteria">
              <label><span>Sender domains</span><textarea value={senderDomains} onChange={(event) => setSenderDomains(event.target.value)} rows={4} placeholder="example.com" /></label>
              <label><span>Sender addresses</span><textarea value={senderAddresses} onChange={(event) => setSenderAddresses(event.target.value)} rows={4} placeholder="person@example.com" /></label>
              <label><span>Recipient terms</span><textarea value={recipientTerms} onChange={(event) => setRecipientTerms(event.target.value)} rows={4} placeholder="finance@, board@" /></label>
              <label><span>Subject prefixes</span><textarea value={subjectPrefixes} onChange={(event) => setSubjectPrefixes(event.target.value)} rows={4} placeholder="RE:, Approval:" /></label>
              <label><span>Subject terms</span><textarea value={subjectTerms} onChange={(event) => setSubjectTerms(event.target.value)} rows={4} placeholder="approval, deadline" /></label>
              <label><span>Body terms</span><textarea value={bodyTerms} onChange={(event) => setBodyTerms(event.target.value)} rows={4} placeholder="wire instructions, term sheet" /></label>
            </div>
          </section>

          <section className="rule-editor-section">
            <div className="rule-editor-section-heading"><strong>AI actions</strong><small>Choose what AI Mail should surface when this rule matches.</small></div>
            <div className="rule-action-grid">
              {actions.map((action) => (
                <label key={action.key} className={draft.actions[action.key] ? "rule-action-card rule-action-card--active" : "rule-action-card"}>
                  <input type="checkbox" checked={Boolean(draft.actions[action.key])} onChange={(event) => setAction(action.key, event.target.checked)} />
                  <span><strong>{action.label}</strong><small>{action.detail}</small></span>
                  <Check size={14} />
                </label>
              ))}
            </div>
          </section>
        </div>

        <footer>
          <span>Protected metadata such as rule ID, system status, and sort order cannot be changed here.</span>
          <div><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />} Save rule</button></div>
        </footer>
      </form>
    </div>
  );
}

export function AiRulesView({ onChanged, editable = false }: { onChanged?: () => void | Promise<void>; editable?: boolean } = {}) {
  const [rules, setRules] = useState<AiRule[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState("");
  const [editingRule, setEditingRule] = useState<AiRule | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRules() {
      setLoadingRules(true);
      setRuleError("");
      try {
        const response = await fetch(webPath("/api/ai-rules"), { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as { rules?: AiRule[]; canManage?: boolean; error?: string } | null;
        if (!response.ok || !result?.rules) throw new Error(result?.error || "Unable to load AI rules.");
        if (!cancelled) {
          setRules(result.rules);
          setCanManage(Boolean(result.canManage));
        }
      } catch (error) {
        if (!cancelled) setRuleError(error instanceof Error ? error.message : "Unable to load AI rules.");
      } finally {
        if (!cancelled) setLoadingRules(false);
      }
    }
    void loadRules();
    return () => { cancelled = true; };
  }, []);

  async function toggleRule(rule: AiRule) {
    if (!canManage || savingRule) return;
    setSavingRule(rule.id);
    setRuleError("");
    try {
      const response = await fetch(webPath("/api/ai-rules"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, active: !rule.active }),
      });
      const result = (await response.json().catch(() => null)) as { rule?: AiRule; error?: string } | null;
      if (!response.ok || !result?.rule) throw new Error(result?.error || "Unable to update AI rule.");
      setRules((current) => current.map((item) => item.id === result.rule?.id ? result.rule as AiRule : item));
      await onChanged?.();
    } catch (error) {
      setRuleError(error instanceof Error ? error.message : "Unable to update AI rule.");
    } finally {
      setSavingRule(null);
    }
  }


  async function saveRule(rule: AiRule) {
    if (!canManage || savingRule) return;
    setSavingRule(rule.id);
    setRuleError("");
    try {
      const response = await fetch(webPath("/api/ai-rules"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule.id,
          title: rule.title,
          description: rule.description,
          category: rule.category,
          priority: rule.priority,
          senderDomains: rule.senderDomains,
          senderAddresses: rule.senderAddresses,
          recipientTerms: rule.recipientTerms,
          subjectTerms: rule.subjectTerms,
          bodyTerms: rule.bodyTerms,
          subjectPrefixes: rule.subjectPrefixes,
          requireReply: rule.requireReply,
          direction: rule.direction,
          actions: rule.actions,
          active: rule.active,
        }),
      });
      const result = (await response.json().catch(() => null)) as { rule?: AiRule; error?: string } | null;
      if (!response.ok || !result?.rule) throw new Error(result?.error || "Unable to save the AI rule.");
      setRules((current) => current.map((item) => item.id === result.rule?.id ? result.rule as AiRule : item));
      setEditingRule(null);
      await onChanged?.();
    } catch (error) {
      setRuleError(error instanceof Error ? error.message : "Unable to save the AI rule.");
    } finally {
      setSavingRule(null);
    }
  }

  const activeCount = rules.filter((rule) => rule.active).length;

  return (
    <div className="settings-page">
      <div className="settings-intro"><p className="eyebrow">AUTOMATION</p><h2>AI rules</h2><p>Persistent inbox rules derived from real r3alm mail patterns. They classify, prioritize, summarize, and surface actions without sending mail automatically.</p></div>
      <section className="rules-hero">
        <span><Bot size={23} /></span><div><h3>Executive triage policy</h3><p>Rules run before heuristic classification and stay server-side across sessions.</p></div><b>{activeCount} active</b>
      </section>
      <section className="panel rules-panel">
        {loadingRules ? <div className="rule-loading"><LoaderCircle className="spin" size={18} /><span>Loading persistent AI rules…</span></div> : null}
        {!loadingRules && rules.map((rule) => (
          <div className="rule-row rule-row--persistent" key={rule.id}>
            <span className="rule-icon"><SlidersHorizontal size={17} /></span>
            <span className="rule-copy">
              <strong>{rule.title}</strong>
              <small>{rule.description}</small>
              <em>{rule.category} · {rule.priority.toUpperCase()}{ruleMatchSummary(rule) ? ` · ${ruleMatchSummary(rule)}` : ""}</em>
            </span>
            <span className="rule-row-actions">
              {editable && canManage ? <button type="button" className="rule-edit-button" onClick={() => setEditingRule(rule)} disabled={savingRule !== null} aria-label={`Edit ${rule.title}`}><Pencil size={14} /> Edit</button> : null}
              <button
                type="button"
                className={rule.active ? "toggle toggle--active" : "toggle"}
                aria-pressed={rule.active}
                aria-label={`${rule.active ? "Disable" : "Enable"} ${rule.title}`}
                disabled={!canManage || savingRule !== null}
                onClick={() => void toggleRule(rule)}
              >{savingRule === rule.id && !editingRule ? <LoaderCircle className="spin" size={13} /> : <span />}</button>
            </span>
          </div>
        ))}
        {!loadingRules && rules.length === 0 ? <div className="rule-loading"><span>No AI rules are configured.</span></div> : null}
      </section>
      {ruleError ? <p className="settings-footnote settings-footnote--error">{ruleError}</p> : null}
      <p className="settings-footnote">{canManage ? "Changes are saved to the workspace database and affect live inbox classification immediately." : "Rules are active workspace policy. An administrator can change their status."}</p>
      {editingRule ? <AiRuleEditor rule={editingRule} saving={savingRule === editingRule.id} onClose={() => setEditingRule(null)} onSave={(rule) => void saveRule(rule)} /> : null}
    </div>
  );
}

export function SettingsView({ status }: { status: AppStatus | null }) {
  const items = [
    { icon: ShieldCheck, title: "Access & security", detail: status?.authentication ? "Password protection is active" : "Add authentication before production" },
    { icon: KeyRound, title: "Environment secrets", detail: "Managed in Vercel Project Settings" },
    { icon: Server, title: "Runtime", detail: "Next.js server functions · iad1 region" },
    { icon: Database, title: "Data retention", detail: "Messages remain on the configured mail server" },
  ];
  return (
    <div className="settings-page">
      <div className="settings-intro"><p className="eyebrow">ADMINISTRATION</p><h2>Settings</h2><p>Review security, runtime, and operational controls.</p></div>
      <section className="panel settings-list">
        {items.map((item) => {
          const Icon = item.icon;
          return <button type="button" key={item.title}><span className="settings-list-icon"><Icon size={19} /></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={17} /></button>;
        })}
      </section>
      <section className="security-callout"><ShieldCheck size={22} /><div><strong>Security model</strong><p>Email and OpenAI credentials are read only inside server functions. They are never sent to the browser or stored in client state.</p></div></section>
    </div>
  );
}
