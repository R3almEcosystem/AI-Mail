"use client";

import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Inbox,
  MailWarning,
  ShieldCheck,
  Tag,
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

  const timeSensitiveMessages = [...messages]
    .filter((message) => message.priority === "urgent" || message.priority === "important" || message.aiEscalate)
    .sort((left, right) => {
      const priorityRank = (message: MailMessage) => message.aiEscalate || message.priority === "urgent" ? 0 : 1;
      const priorityDifference = priorityRank(left) - priorityRank(right);
      if (priorityDifference) return priorityDifference;
      if (left.unread !== right.unread) return left.unread ? -1 : 1;
      return Date.parse(right.receivedAt) - Date.parse(left.receivedAt);
    })
    .slice(0, 4);

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
          <p>{timeSensitiveMessages.length ? `${timeSensitiveMessages.length} time-sensitive message${timeSensitiveMessages.length === 1 ? "" : "s"} currently need attention.` : "No urgent or important messages are currently in the loaded inbox view."}</p>
        </div>
        <div className="insight-list">
          <div><Clock3 size={16} /><span><strong>Best response window</strong><small>Prioritize urgent and unread important messages first.</small></span></div>
          <div><CheckCircle2 size={16} /><span><strong>Likely quick wins</strong><small>{messages.filter((message) => message.unread && message.priority === "important").length} unread important messages can be reviewed next.</small></span></div>
          <div><MailWarning size={16} /><span><strong>Watch item</strong><small>{timeSensitiveMessages[0]?.subject || "No current urgent watch item"}</small></span></div>
        </div>

        <div className="time-sensitive-section">
          <div className="time-sensitive-heading">
            <div><p className="eyebrow">TIME SENSITIVE</p><h4>Emails needing attention</h4></div>
            <span>{timeSensitiveMessages.length}</span>
          </div>
          <div className="time-sensitive-list">
            {timeSensitiveMessages.length ? timeSensitiveMessages.map((message) => (
              <button
                type="button"
                className={`time-sensitive-item time-sensitive-item--${message.aiEscalate || message.priority === "urgent" ? "urgent" : "important"}`}
                key={`${message.accountId || "primary"}:${message.uid}`}
                onClick={() => onSelect(message)}
              >
                <span className="time-sensitive-topline">
                  <strong>{message.sender}</strong>
                  <small>{relativeTime(message.receivedAt)}</small>
                </span>
                <b>{message.subject}</b>
                <span className="time-sensitive-meta">
                  <em className={`priority-pill priority-pill--${message.aiEscalate ? "urgent" : message.priority}`}>{message.aiEscalate ? "escalated" : message.priority}</em>
                  <em><Inbox size={11} /> {message.accountLabel || "Primary mailbox"}</em>
                  <em><Tag size={11} /> {message.category}</em>
                </span>
                <span className="time-sensitive-preview">{message.preview}</span>
                <span className="time-sensitive-context">
                  <small>{message.unread ? "Unread" : "Read"}</small>
                  <small>{message.aiRuleMatches?.length ? `${message.aiRuleMatches.length} AI rule${message.aiRuleMatches.length === 1 ? "" : "s"} matched` : "Priority detection"}</small>
                </span>
              </button>
            )) : (
              <div className="time-sensitive-empty"><CheckCircle2 size={18} /><span><strong>No time-sensitive email</strong><small>Urgent and important messages will appear here automatically.</small></span></div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
