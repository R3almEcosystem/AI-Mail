"use client";

import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Inbox,
  MailWarning,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { AppStatus, MailMessage } from "@/lib/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(date: string) {
  const difference = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.floor(difference / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function OverviewView({
  messages,
  status,
  userName,
  onOpenInbox,
  onSelect,
}: {
  messages: MailMessage[];
  status: AppStatus | null;
  userName: string;
  onOpenInbox: () => void;
  onSelect: (message: MailMessage) => void;
}) {
  const unread = messages.filter((message) => message.unread).length;
  const important = messages.filter(
    (message) => message.priority === "urgent" || message.priority === "important",
  ).length;

  return (
    <div className="overview-grid">
      <section className="welcome-card">
        <div>
          <span className="welcome-kicker"><Sparkles size={15} /> AI-MAIL BRIEFING</span>
          <h2>Welcome back, {userName.split(" ")[0]}.</h2>
          <p>
            You have <strong>{unread} unread messages</strong> and {important} items that may
            need attention. AI triage is ready to help you move through them.
          </p>
          <button type="button" className="light-button" onClick={onOpenInbox}>
            Review priority inbox <ArrowRight size={16} />
          </button>
        </div>
        <div className="welcome-orbit" aria-hidden="true">
          <div className="orbit orbit--one" />
          <div className="orbit orbit--two" />
          <Bot size={38} />
        </div>
      </section>

      <section className="metrics-row" aria-label="Mailbox summary">
        <article className="metric-card">
          <span className="metric-icon metric-icon--blue"><Inbox size={19} /></span>
          <div><small>UNREAD</small><strong>{unread}</strong><span>Across the inbox</span></div>
        </article>
        <article className="metric-card">
          <span className="metric-icon metric-icon--amber"><MailWarning size={19} /></span>
          <div><small>PRIORITY</small><strong>{important}</strong><span>Need a response</span></div>
        </article>
        <article className="metric-card">
          <span className="metric-icon metric-icon--violet"><Bot size={19} /></span>
          <div><small>AI ASSIST</small><strong>{status?.openai ? "Live" : "Demo"}</strong><span>{status?.model || "Preview mode"}</span></div>
        </article>
        <article className="metric-card">
          <span className="metric-icon metric-icon--green"><ShieldCheck size={19} /></span>
          <div><small>SECURITY</small><strong>{status?.authentication ? "On" : "Setup"}</strong><span>Private console</span></div>
        </article>
      </section>

      <section className="panel priority-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">FOCUS QUEUE</p><h3>Priority messages</h3></div>
          <button type="button" className="text-button" onClick={onOpenInbox}>View all <ArrowRight size={15} /></button>
        </div>
        <div className="priority-list">
          {messages.slice(0, 4).map((message) => (
            <button type="button" className="priority-item" key={message.uid} onClick={() => onSelect(message)}>
              <span className={`sender-avatar sender-avatar--${message.uid % 4}`}>{initials(message.sender)}</span>
              <span className="priority-copy">
                <span><strong>{message.sender}</strong><small>{relativeTime(message.receivedAt)}</small></span>
                <b>{message.subject}</b>
                <em>{message.preview}</em>
              </span>
              <span className={`priority-pill priority-pill--${message.priority}`}>{message.priority}</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="panel intelligence-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">TODAY</p><h3>AI intelligence</h3></div>
          <span className="spark-icon"><Sparkles size={17} /></span>
        </div>
        <div className="intelligence-score">
          <div className="score-ring"><strong>82</strong><span>focus</span></div>
          <p>Your inbox is under control. Two messages are time-sensitive.</p>
        </div>
        <div className="insight-list">
          <div><Clock3 size={16} /><span><strong>Best response window</strong><small>Before 10:00 AM tomorrow</small></span></div>
          <div><CheckCircle2 size={16} /><span><strong>Likely quick wins</strong><small>3 messages can close today</small></span></div>
          <div><MailWarning size={16} /><span><strong>Watch item</strong><small>North Capital follow-up</small></span></div>
        </div>
      </aside>
    </div>
  );
}
