"use client";

import { useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Inbox,
  MailOpen,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Reply,
  Search,
  Send,
  Sparkles,
  Star,
  Tag,
} from "lucide-react";
import type { AiAction, MailMessage } from "@/lib/types";

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(date: string) {
  const parsed = new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function InboxWorkspace({
  messages,
  selected,
  filter,
  search,
  loading,
  aiLoading,
  aiResult,
  demo,
  onFilterChange,
  onSearchChange,
  onSelect,
  onAction,
  onAiAction,
  onCompose,
  onRefresh,
}: {
  messages: MailMessage[];
  selected: MailMessage | null;
  filter: "all" | "unread" | "flagged";
  search: string;
  loading: boolean;
  aiLoading: boolean;
  aiResult: string;
  demo: boolean;
  onFilterChange: (filter: "all" | "unread" | "flagged") => void;
  onSearchChange: (value: string) => void;
  onSelect: (message: MailMessage) => void;
  onAction: (action: "read" | "unread" | "flag" | "unflag" | "archive") => void;
  onAiAction: (action: AiAction) => void;
  onCompose: () => void;
  onRefresh: () => void;
}) {
  const [mobileDetail, setMobileDetail] = useState(false);

  return (
    <section className={mobileDetail ? "inbox-layout inbox-layout--mobile-detail" : "inbox-layout"}>
      <div className="mail-list-panel">
        <div className="mail-list-heading">
          <div><p className="eyebrow">PRIMARY</p><h2>Inbox <span>{messages.length}</span></h2></div>
          <button type="button" className="icon-button" onClick={onRefresh} aria-label="Refresh inbox">
            <RefreshCw size={17} className={loading ? "spin" : ""} />
          </button>
        </div>
        <div className="mail-search">
          <Search size={16} />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search mail" aria-label="Search mail" />
        </div>
        <div className="filter-tabs" role="tablist" aria-label="Inbox filters">
          {(["all", "unread", "flagged"] as const).map((item) => (
            <button type="button" role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} onClick={() => onFilterChange(item)} key={item}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <div className="mail-items">
          {messages.length ? messages.map((message) => (
            <button
              type="button"
              className={`mail-item ${selected?.uid === message.uid ? "mail-item--selected" : ""} ${message.unread ? "mail-item--unread" : ""}`}
              key={message.uid}
              onClick={() => {
                onSelect(message);
                setMobileDetail(true);
              }}
            >
              <span className={`sender-avatar sender-avatar--${message.uid % 4}`}>{initials(message.sender)}</span>
              <span className="mail-item-copy">
                <span className="mail-item-top"><strong>{message.sender}</strong><small>{formatDate(message.receivedAt)}</small></span>
                <span className="mail-item-subject">{message.subject}</span>
                <span className="mail-item-preview">{message.preview}</span>
                <span className="mail-item-meta">
                  <i className={`priority-dot priority-dot--${message.priority}`} />
                  <em>{message.category}</em>
                  {message.attachments ? <span><Paperclip size={12} />{message.attachments}</span> : null}
                </span>
              </span>
              {message.unread ? <i className="unread-dot" aria-label="Unread" /> : null}
            </button>
          )) : (
            <div className="empty-state"><Inbox size={24} /><strong>No messages found</strong><span>Try a different filter or search.</span></div>
          )}
        </div>
      </div>

      <article className="message-panel">
        {selected ? (
          <>
            <div className="message-toolbar">
              <button type="button" className="icon-button mobile-back" onClick={() => setMobileDetail(false)} aria-label="Back to messages"><ArrowLeft size={17} /></button>
              <button type="button" className="icon-button" onClick={() => onAction(selected.unread ? "read" : "unread")} aria-label={selected.unread ? "Mark as read" : "Mark as unread"}><MailOpen size={17} /></button>
              <button type="button" className="icon-button" onClick={() => onAction("archive")} aria-label="Archive"><Archive size={17} /></button>
              <button type="button" className={`icon-button ${selected.flagged ? "icon-button--active" : ""}`} onClick={() => onAction(selected.flagged ? "unflag" : "flag")} aria-label="Flag message"><Star size={17} /></button>
              <span className="toolbar-divider" />
              <button type="button" className="icon-button" aria-label="Tag"><Tag size={17} /></button>
              <button type="button" className="icon-button" aria-label="More options"><MoreHorizontal size={18} /></button>
            </div>
            <header className="message-header">
              <span className={`priority-pill priority-pill--${selected.priority}`}>{selected.priority}</span>
              <h1>{selected.subject}</h1>
              <div className="sender-line">
                <span className={`sender-avatar sender-avatar--${selected.uid % 4}`}>{initials(selected.sender)}</span>
                <span><strong>{selected.sender}</strong><small>{selected.senderEmail}</small></span>
                <time>{formatDate(selected.receivedAt)}</time>
                <button type="button" className="icon-button" aria-label="Message details"><ChevronDown size={15} /></button>
              </div>
            </header>
            <div className="message-body">
              {(selected.body || selected.preview).split("\n").map((paragraph, index) => (
                <p key={`${selected.uid}-${index}`}>{paragraph || "\u00a0"}</p>
              ))}
            </div>
            <div className="message-actions">
              <button type="button" className="secondary-button" onClick={onCompose}><Reply size={16} /> Reply</button>
              <button type="button" className="secondary-button" onClick={onCompose}><Send size={16} /> Forward</button>
            </div>
          </>
        ) : (
          <div className="empty-message"><MailOpen size={28} /><h2>Select a message</h2><p>Choose an email to read and analyze.</p></div>
        )}
      </article>

      <aside className="ai-panel">
        <div className="ai-panel-heading">
          <span className="ai-orb"><Sparkles size={17} /></span>
          <div><p className="eyebrow">OPENAI COPILOT</p><h3>Mail intelligence</h3></div>
          <span className={demo ? "mode-badge mode-badge--demo" : "mode-badge"}>{demo ? "Demo" : "Live"}</span>
        </div>

        {selected ? (
          <>
            <div className="ai-actions-grid">
              <button type="button" onClick={() => onAiAction("summarize")} disabled={aiLoading}><Bot size={16} /><span><strong>Summarize</strong><small>Key points</small></span></button>
              <button type="button" onClick={() => onAiAction("draft")} disabled={aiLoading}><Reply size={16} /><span><strong>Draft reply</strong><small>Executive tone</small></span></button>
              <button type="button" onClick={() => onAiAction("extract")} disabled={aiLoading}><Check size={16} /><span><strong>Actions</strong><small>Extract tasks</small></span></button>
              <button type="button" onClick={() => onAiAction("prioritize")} disabled={aiLoading}><Tag size={16} /><span><strong>Prioritize</strong><small>Assess urgency</small></span></button>
            </div>
            <div className="ai-result">
              <div><strong>{aiLoading ? "Thinking…" : aiResult ? "AI result" : "Ready to assist"}</strong><Sparkles size={14} /></div>
              {aiLoading ? (
                <div className="ai-loading"><span /><span /><span /></div>
              ) : (
                <p>{aiResult || "Choose an AI action to summarize, draft, extract, or prioritize this message."}</p>
              )}
            </div>
            <div className="ai-context-card">
              <span><strong>Context signals</strong><small>Derived from this message</small></span>
              <div><span>Category</span><b>{selected.category}</b></div>
              <div><span>Priority</span><b>{selected.priority}</b></div>
              <div><span>Response</span><b>{selected.unread ? "Pending" : "Reviewed"}</b></div>
            </div>
          </>
        ) : (
          <div className="ai-empty"><Bot size={22} /><p>Select a message to activate AI assistance.</p></div>
        )}
      </aside>
    </section>
  );
}
