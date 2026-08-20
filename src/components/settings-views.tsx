"use client";

import { useState } from "react";
import {
  Bot,
  Check,
  ChevronRight,
  Database,
  KeyRound,
  MailCheck,
  Network,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { AppStatus } from "@/lib/types";

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
      <section className="panel configuration-panel">
        <div className="panel-heading"><div><p className="eyebrow">READINESS</p><h3>Configuration checklist</h3></div><span className="configuration-score">{[status?.imap, status?.smtp, status?.openai, status?.authentication].filter(Boolean).length}/4</span></div>
        <StatusRow ready={Boolean(status?.imap)} label="Incoming mailbox" detail="IMAP host, user, password, port, and TLS mode" />
        <StatusRow ready={Boolean(status?.smtp)} label="Outbound delivery" detail="SMTP host, sender, user, password, port, and TLS mode" />
        <StatusRow ready={Boolean(status?.openai)} label="OpenAI intelligence" detail="OPENAI_API_KEY and OPENAI_MODEL" />
        <StatusRow ready={Boolean(status?.authentication || status?.demoLogin)} label="Console authentication" detail="Signed user sessions and role-based access" />
      </section>
    </div>
  );
}

const initialRules = [
  { id: "priority", title: "Priority detection", text: "Elevate deadlines, board matters, legal requests, and capital-market actions.", active: true },
  { id: "summary", title: "Automatic summaries", text: "Prepare concise executive summaries for messages longer than 250 words.", active: true },
  { id: "draft", title: "Reply suggestions", text: "Offer a response draft when an email contains a direct question or request.", active: true },
  { id: "risk", title: "Risk and compliance scan", text: "Flag unusual payment instructions, credential requests, and high-risk language.", active: true },
  { id: "newsletter", title: "Newsletter compression", text: "Reduce newsletters and notifications to a one-line digest.", active: false },
];

export function AiRulesView() {
  const [rules, setRules] = useState(initialRules);
  return (
    <div className="settings-page">
      <div className="settings-intro"><p className="eyebrow">AUTOMATION</p><h2>AI rules</h2><p>Control how AI-Mail classifies and assists with incoming messages.</p></div>
      <section className="rules-hero">
        <span><Bot size={23} /></span><div><h3>Executive triage policy</h3><p>Rules guide the assistant; they never send mail automatically.</p></div><b>{rules.filter((rule) => rule.active).length} active</b>
      </section>
      <section className="panel rules-panel">
        {rules.map((rule) => (
          <div className="rule-row" key={rule.id}>
            <span className="rule-icon"><SlidersHorizontal size={17} /></span>
            <span><strong>{rule.title}</strong><small>{rule.text}</small></span>
            <button
              type="button"
              className={rule.active ? "toggle toggle--active" : "toggle"}
              aria-pressed={rule.active}
              aria-label={`${rule.active ? "Disable" : "Enable"} ${rule.title}`}
              onClick={() => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, active: !item.active } : item))}
            ><span /></button>
          </div>
        ))}
      </section>
      <p className="settings-footnote">Rule changes in this preview are local to your browser until persistent storage is connected.</p>
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
