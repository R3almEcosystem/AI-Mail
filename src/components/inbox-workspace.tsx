"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Inbox,
  Mail,
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
import type { AiAction, MailMessage, MailTag } from "@/lib/types";
import { MessageSecurityPanel } from "./message-security-panel";

const MAIL_TAG_OPTIONS: ReadonlyArray<{ id: MailTag; label: string }> = [
  { id: "follow-up", label: "Follow Up" },
  { id: "waiting", label: "Waiting" },
  { id: "finance", label: "Finance" },
  { id: "legal", label: "Legal" },
  { id: "technology", label: "Technology" },
  { id: "personal", label: "Personal" },
];

const mailTagLabels = Object.fromEntries(MAIL_TAG_OPTIONS.map((tag) => [tag.id, tag.label])) as Record<MailTag, string>;

function mailTagLabel(tag: MailTag) {
  return mailTagLabels[tag];
}

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
  actionLoading = false,
  aiResult,
  demo,
  aiConfigured = false,
  mailboxLabel = "Inbox",
  mailboxEyebrow = "PRIMARY",
  loadedCount = messages.length,
  totalCount = messages.length,
  hasMore = false,
  loadingMore = false,
  sentMode = false,
  onFilterChange,
  onSearchChange,
  onSelect,
  onAction,
  onAiAction,
  onCompose,
  onRefresh,
  onLoadMore,
  onOpenResearch,
}: {
  messages: MailMessage[];
  selected: MailMessage | null;
  filter: "all" | "unread" | "flagged";
  search: string;
  loading: boolean;
  aiLoading: boolean;
  actionLoading?: boolean;
  aiResult: string;
  demo: boolean;
  aiConfigured?: boolean;
  mailboxLabel?: string;
  mailboxEyebrow?: string;
  loadedCount?: number;
  totalCount?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  sentMode?: boolean;
  onFilterChange: (filter: "all" | "unread" | "flagged") => void;
  onSearchChange: (value: string) => void;
  onSelect: (message: MailMessage) => void;
  onAction: (action: "read" | "unread" | "flag" | "unflag" | "archive" | "tag" | "untag", tag?: MailTag) => void;
  onAiAction: (action: AiAction) => void;
  onCompose: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenResearch: () => void;
}) {
  const [mobileDetail, setMobileDetail] = useState(false);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const mailListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTagMenuOpen(false);
    setMoreMenuOpen(false);
    setDetailsOpen(false);
  }, [selected?.folder, selected?.uid]);

  useEffect(() => {
    const list = mailListRef.current;
    const canAutoFill = filter === "all" && !search.trim();
    if (!list || !canAutoFill || !hasMore || loading || loadingMore) return;
    if (list.scrollHeight <= list.clientHeight + 80) onLoadMore();
  }, [filter, hasMore, loadedCount, loading, loadingMore, onLoadMore, search]);

  return (
    <section className={mobileDetail ? "inbox-layout inbox-layout--mobile-detail" : "inbox-layout"}>
      <div className="mail-list-panel">
        <div className="mail-list-heading">
          <div><p className="eyebrow">{mailboxEyebrow}</p><h2>{mailboxLabel} <span>{loadedCount < totalCount ? `${loadedCount} of ${totalCount}` : totalCount}</span></h2></div>
          <div className="mail-list-heading-actions">
            <button type="button" className="icon-button research-launch-button" onClick={onOpenResearch} aria-label={`Open AI research for ${mailboxLabel}`} title="AI Mail Research">
              <Sparkles size={17} />
            </button>
            <button type="button" className="icon-button" onClick={onRefresh} aria-label={`Refresh ${mailboxLabel.toLowerCase()}`}>
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
          </div>
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
        <div
          className="mail-items"
          ref={mailListRef}
          onScroll={(event) => {
            const list = event.currentTarget;
            if (!hasMore || loadingMore || loading) return;
            if (list.scrollHeight - list.scrollTop - list.clientHeight < 240) onLoadMore();
          }}
        >
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
                <span className="mail-item-top"><strong>{sentMode ? `To: ${message.recipientLabel || "Recipient"}` : message.sender}</strong><small>{formatDate(message.receivedAt)}</small></span>
                <span className="mail-item-subject">{message.subject}</span>
                <span className="mail-item-preview">{message.preview}</span>
                <span className="mail-item-meta">
                  <i className={`priority-dot priority-dot--${message.priority}`} />
                  <em>{message.category}</em>
                  {message.flagged ? <span className="mail-item-state"><Star size={11} fill="currentColor" /> Flagged</span> : null}
                  {(message.tags || []).slice(0, 2).map((tag) => <span className="mail-item-tag" key={tag}>{mailTagLabel(tag)}</span>)}
                  {(message.tags || []).length > 2 ? <span className="mail-item-tag">+{(message.tags || []).length - 2}</span> : null}
                  {message.attachments ? <span><Paperclip size={12} />{message.attachments}</span> : null}
                </span>
              </span>
              {message.unread ? <i className="unread-dot" aria-label="Unread" /> : null}
            </button>
          )) : (
            <div className="empty-state"><Inbox size={24} /><strong>No messages found</strong><span>Try a different filter or search.</span></div>
          )}
          {hasMore || loadingMore ? (
            <div className="mail-load-more">
              <button type="button" onClick={onLoadMore} disabled={loadingMore || loading}>
                {loadingMore ? <><RefreshCw size={13} className="spin" /> Loading older messages…</> : <>Load older messages <span>+50</span></>}
              </button>
            </div>
          ) : loadedCount > 0 ? (
            <div className="mail-list-complete">All {totalCount} messages loaded</div>
          ) : null}
        </div>
      </div>

      <article className="message-panel">
        {selected ? (
          <>
            <div className="message-toolbar">
              <button type="button" className="icon-button mobile-back" onClick={() => setMobileDetail(false)} aria-label="Back to messages"><ArrowLeft size={17} /></button>
              <button
                type="button"
                className={`icon-button message-status-button ${selected.unread ? "message-status-button--unread" : "message-status-button--read"}`}
                onClick={() => onAction(selected.unread ? "read" : "unread")}
                aria-label={selected.unread ? "Mark as read" : "Mark as unread"}
                data-state={selected.unread ? "unread" : "read"}
                disabled={actionLoading}
              >
                {selected.unread ? <Mail size={17} strokeWidth={2.2} /> : <MailOpen size={17} strokeWidth={2.1} />}
              </button>
              <button type="button" className="icon-button" onClick={() => onAction("archive")} aria-label="Archive message" disabled={actionLoading}><Archive size={17} /></button>
              <button
                type="button"
                className={`icon-button message-status-button ${selected.flagged ? "message-status-button--flagged" : "message-status-button--unflagged"}`}
                onClick={() => onAction(selected.flagged ? "unflag" : "flag")}
                aria-label={selected.flagged ? "Unflag message" : "Flag message"}
                aria-pressed={selected.flagged}
                data-state={selected.flagged ? "flagged" : "unflagged"}
                disabled={actionLoading}
              ><Star size={17} strokeWidth={selected.flagged ? 2 : 1.9} fill={selected.flagged ? "currentColor" : "none"} /></button>
              <span className="toolbar-divider" />
              <div className="message-toolbar-menu">
                <button
                  type="button"
                  className={`icon-button message-status-button ${(selected.tags || []).length ? "message-status-button--tagged" : "message-status-button--untagged"}`}
                  aria-label={(selected.tags || []).length ? `Manage message tags, ${(selected.tags || []).length} applied` : "Manage message tags"}
                  data-state={(selected.tags || []).length ? "tagged" : "untagged"}
                  aria-expanded={tagMenuOpen}
                  onClick={() => { setTagMenuOpen((open) => !open); setMoreMenuOpen(false); }}
                  disabled={actionLoading}
                ><Tag size={17} strokeWidth={(selected.tags || []).length ? 2.2 : 1.9} fill={(selected.tags || []).length ? "currentColor" : "none"} /></button>
                {tagMenuOpen ? (
                  <div className="message-popover message-tag-menu" role="menu" aria-label="Message tags">
                    <header><strong>Message tags</strong><small>Saved to the mailbox</small></header>
                    {MAIL_TAG_OPTIONS.map((option) => {
                      const active = (selected.tags || []).includes(option.id);
                      return (
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={active}
                          key={option.id}
                          onClick={() => onAction(active ? "untag" : "tag", option.id)}
                          disabled={actionLoading}
                        >
                          <span className={`message-tag-dot message-tag-dot--${option.id}`} />
                          <span>{option.label}</span>
                          {active ? <Check size={14} /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="message-toolbar-menu">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="More message actions"
                  aria-expanded={moreMenuOpen}
                  onClick={() => { setMoreMenuOpen((open) => !open); setTagMenuOpen(false); }}
                  disabled={actionLoading}
                ><MoreHorizontal size={18} /></button>
                {moreMenuOpen ? (
                  <div className="message-popover message-more-menu" role="menu" aria-label="More message actions">
                    <button type="button" role="menuitem" onClick={() => { onAction(selected.unread ? "read" : "unread"); setMoreMenuOpen(false); }}>
                      {selected.unread ? <Mail size={14} /> : <MailOpen size={14} />} {selected.unread ? "Mark as read" : "Mark as unread"}
                    </button>
                    <button type="button" role="menuitem" onClick={() => { onAction(selected.flagged ? "unflag" : "flag"); setMoreMenuOpen(false); }}>
                      <Star size={14} fill={selected.flagged ? "currentColor" : "none"} /> {selected.flagged ? "Remove flag" : "Flag message"}
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); setTagMenuOpen(true); }}>
                      <Tag size={14} /> Manage tags
                    </button>
                    <button type="button" role="menuitem" className="message-menu-danger" onClick={() => { onAction("archive"); setMoreMenuOpen(false); }}>
                      <Archive size={14} /> Archive message
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <header className="message-header">
              <div className="message-status-row">
                <span className={`priority-pill priority-pill--${selected.priority}`}>{selected.priority}</span>
                <span className={selected.unread ? "message-state-pill message-state-pill--unread" : "message-state-pill"}>{selected.unread ? "Unread" : "Read"}</span>
                {selected.flagged ? <span className="message-state-pill message-state-pill--flagged"><Star size={10} /> Flagged</span> : null}
                {(selected.tags || []).map((tag) => <span className="message-tag-pill" key={tag}>{mailTagLabel(tag)}</span>)}
              </div>
              <h1>{selected.subject}</h1>
              <div className="sender-line">
                <span className={`sender-avatar sender-avatar--${selected.uid % 4}`}>{initials(selected.sender)}</span>
                <span><strong>{sentMode ? `To: ${selected.recipientLabel || "Recipient"}` : selected.sender}</strong><small>{sentMode ? selected.senderEmail : selected.senderEmail}</small></span>
                <time>{formatDate(selected.receivedAt)}</time>
                <button
                  type="button"
                  className={`icon-button message-details-toggle ${detailsOpen ? "icon-button--active" : ""}`}
                  aria-label={detailsOpen ? "Hide message details" : "Show message details"}
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((open) => !open)}
                ><ChevronDown size={15} /></button>
              </div>
              {detailsOpen ? (
                <dl className="message-details-card">
                  <div><dt>From</dt><dd>{selected.sender}{selected.senderEmail ? ` <${selected.senderEmail}>` : ""}</dd></div>
                  <div><dt>To</dt><dd>{selected.recipientLabel || (sentMode ? "Recipient" : "Current mailbox")}</dd></div>
                  <div><dt>Date</dt><dd>{new Date(selected.receivedAt).toLocaleString()}</dd></div>
                  <div><dt>Mailbox</dt><dd>{sentMode ? "Sent" : "Inbox"}</dd></div>
                  <div><dt>Status</dt><dd>{selected.unread ? "Unread" : "Read"} · {selected.flagged ? "Flagged" : "Not flagged"}</dd></div>
                  <div><dt>Tags</dt><dd>{(selected.tags || []).length ? (selected.tags || []).map(mailTagLabel).join(", ") : "None"}</dd></div>
                </dl>
              ) : null}
            </header>
            <MessageSecurityPanel assessment={selected.security} inspection={selected.attachmentInspection} demo={demo} />
            <div className="message-body">
              {(selected.body || selected.preview).split("\n").map((paragraph, index) => (
                <p key={`${selected.uid}-${index}`}>{paragraph || "\u00a0"}</p>
              ))}
            </div>
            <div className="message-actions">
              {!sentMode ? <button type="button" className="secondary-button" onClick={onCompose}><Reply size={16} /> Reply</button> : null}
              <button type="button" className="secondary-button" onClick={onCompose}><Send size={16} /> {sentMode ? "New message" : "Forward"}</button>
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
          <span className={demo ? "mode-badge mode-badge--demo" : "mode-badge"}>{demo ? "Demo" : aiConfigured ? "Available" : "Not configured"}</span>
        </div>
        {!demo && !aiConfigured ? <p className="ai-empty">AI is not configured. Email-security inspection remains independent and available.</p> : null}
        {selected ? (
          <>
            <div className="ai-actions-grid">
              <button type="button" onClick={() => onAiAction("summarize")} disabled={aiLoading || (!demo && !aiConfigured)}><Bot size={16} /><span><strong>Summarize</strong><small>Key points</small></span></button>
              <button type="button" onClick={() => onAiAction("draft")} disabled={aiLoading || (!demo && !aiConfigured)}><Reply size={16} /><span><strong>Draft reply</strong><small>Executive tone</small></span></button>
              <button type="button" onClick={() => onAiAction("extract")} disabled={aiLoading || (!demo && !aiConfigured)}><Check size={16} /><span><strong>Actions</strong><small>Extract tasks</small></span></button>
              <button type="button" onClick={() => onAiAction("prioritize")} disabled={aiLoading || (!demo && !aiConfigured)}><Tag size={16} /><span><strong>Prioritize</strong><small>Assess urgency</small></span></button>
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
              <div><span>Mailbox status</span><b>{selected.unread ? "Unread" : "Read"}</b></div>
              <div><span>Flag</span><b>{selected.flagged ? "Flagged" : "None"}</b></div>
              <div><span>Tags</span><b>{(selected.tags || []).length ? (selected.tags || []).map(mailTagLabel).join(", ") : "None"}</b></div>
              <div><span>Response</span><b>{sentMode ? "Sent" : selected.unread ? "Pending" : "Reviewed"}</b></div>
            </div>
          </>
        ) : (
          <div className="ai-empty"><Bot size={22} /><p>Select a message to activate AI assistance.</p></div>
        )}
      </aside>
    </section>
  );
}
