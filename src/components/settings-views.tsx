"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  ChevronRight,
  Database,
  KeyRound,
  MailCheck,
  Network,
  LoaderCircle,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
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

export function AiRulesView({ onChanged }: { onChanged?: () => void | Promise<void> } = {}) {
  const [rules, setRules] = useState<AiRule[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState("");

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
            <button
              type="button"
              className={rule.active ? "toggle toggle--active" : "toggle"}
              aria-pressed={rule.active}
              aria-label={`${rule.active ? "Disable" : "Enable"} ${rule.title}`}
              disabled={!canManage || savingRule !== null}
              onClick={() => void toggleRule(rule)}
            >{savingRule === rule.id ? <LoaderCircle className="spin" size={13} /> : <span />}</button>
          </div>
        ))}
        {!loadingRules && rules.length === 0 ? <div className="rule-loading"><span>No AI rules are configured.</span></div> : null}
      </section>
      {ruleError ? <p className="settings-footnote settings-footnote--error">{ruleError}</p> : null}
      <p className="settings-footnote">{canManage ? "Changes are saved to the workspace database and affect live inbox classification immediately." : "Rules are active workspace policy. An administrator can change their status."}</p>
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
