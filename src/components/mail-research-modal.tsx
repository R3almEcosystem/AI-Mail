"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Bot, Download, FileText, History, LoaderCircle, Maximize2, Minimize2, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { webPath } from "@/lib/web-path";
import type { MailAccountSummary } from "@/lib/types";

export type ResearchScope = "inbox" | "sent" | "both";

type ResearchResult = {
  title: string;
  markdown: string;
  scope: ResearchScope;
  mode: "collection" | "report";
  matched: number;
  included: number;
  excluded: number;
  capped: boolean;
  model: string | null;
  warnings: string[];
};

type ResearchPayload = ResearchResult & {
  historySaved?: boolean;
  historyId?: string | null;
  historyCreatedAt?: string | null;
};

type ResearchHistorySummary = {
  id: string;
  query: string;
  requestedScope: ResearchScope;
  scope: ResearchScope;
  title: string;
  mode: "collection" | "report";
  matched: number;
  included: number;
  excluded: number;
  capped: boolean;
  model: string | null;
  warnings: string[];
  createdAt: string;
};

type ResearchHistoryDetail = ResearchHistorySummary & {
  markdown: string;
};

type HistoryResponse = {
  items: ResearchHistorySummary[];
  hasMore: boolean;
  nextOffset: number | null;
};

const examples = [
  "Compile all emails sent to bernie@r3alm.com into one document.",
  "Find all emails received from Coinbase and summarize the outstanding requests.",
  "Find all emails that mention R3EQ and prepare a chronology.",
  "Review correspondence with Bob Hesse and summarize decisions, requests, and unresolved items.",
];

function safeFilename(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return (cleaned || "ai-mail-research") + ".md";
}

function downloadMarkdown(title: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(title);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatResearchDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}


function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[M\d+-\d+\])/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return <code key={index}>{token.slice(1, -1)}</code>;
    }
    if (/^\[M\d+-\d+\]$/.test(token)) {
      return <span className="research-citation" key={index}>{token}</span>;
    }
    return token;
  });
}

function MarkdownReport({ markdown, className = "" }: { markdown: string; className?: string }) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered = false;
  let quote: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    nodes.push(<p key={"p-" + nodes.length}>{renderInlineMarkdown(paragraph.join(" "))}</p>);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    const items = list.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>);
    nodes.push(ordered ? <ol key={"ol-" + nodes.length}>{items}</ol> : <ul key={"ul-" + nodes.length}>{items}</ul>);
    list = [];
  }

  function flushQuote() {
    if (!quote.length) return;
    nodes.push(
      <blockquote key={"q-" + nodes.length}>
        {quote.map((line, index) => <span key={index}>{renderInlineMarkdown(line)}{index < quote.length - 1 ? <br /> : null}</span>)}
      </blockquote>,
    );
    quote = [];
  }

  function flushAll() {
    flushParagraph();
    flushList();
    flushQuote();
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushAll();
      continue;
    }
    if (line.trim() === "---" || line.trim() === "***") {
      flushAll();
      nodes.push(<hr key={"hr-" + nodes.length} />);
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const body = renderInlineMarkdown(heading[2]);
      if (level === 1) nodes.push(<h1 key={"h1-" + nodes.length}>{body}</h1>);
      else if (level === 2) nodes.push(<h2 key={"h2-" + nodes.length}>{body}</h2>);
      else if (level === 3) nodes.push(<h3 key={"h3-" + nodes.length}>{body}</h3>);
      else nodes.push(<h4 key={"h4-" + nodes.length}>{body}</h4>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }
    const unordered = /^[-*]\s+(.+)$/.exec(line);
    if (unordered) {
      flushParagraph();
      flushQuote();
      if (list.length && ordered) flushList();
      ordered = false;
      list.push(unordered[1]);
      continue;
    }
    const orderedMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      if (list.length && !ordered) flushList();
      ordered = true;
      list.push(orderedMatch[1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  flushAll();

  return <article className={"research-document research-markdown " + className}>{nodes}</article>;
}


function MailResearchSurface({
  open,
  defaultScope,
  defaultAccountId = "all",
  onClose,
  panel = false,
}: {
  open: boolean;
  defaultScope: ResearchScope;
  defaultAccountId?: string;
  onClose?: () => void;
  panel?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ResearchScope>(defaultScope);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [accounts, setAccounts] = useState<MailAccountSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");
  const [historySaveWarning, setHistorySaveWarning] = useState("");
  const [activeTab, setActiveTab] = useState<"research" | "history">("research");
  const [historyItems, setHistoryItems] = useState<ResearchHistorySummary[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyNextOffset, setHistoryNextOffset] = useState<number | null>(0);
  const [selectedHistory, setSelectedHistory] = useState<ResearchHistorySummary | null>(null);
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<ResearchHistoryDetail | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [expandedReport, setExpandedReport] = useState<"research" | "history" | null>(null);

  useEffect(() => {
    if (!open) return;
    setScope(defaultScope);
    setAccountId(defaultAccountId);
    setError("");
    void fetch(webPath("/api/mail-accounts"), { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload: { accounts?: MailAccountSummary[] } | null) => {
        if (payload?.accounts) setAccounts(payload.accounts);
      })
      .catch(() => {});
  }, [defaultAccountId, defaultScope, open]);

  useEffect(() => {
    if (!panel || activeTab !== "history" || historyLoaded || historyLoading) return;
    void loadHistory(true);
  }, [activeTab, historyLoaded, historyLoading, panel]);

  if (!open) return null;

  async function runResearch() {
    const instruction = query.trim();
    if (instruction.length < 3 || loading) return;
    setLoading(true);
    setError("");
    setHistorySaveWarning("");
    setResult(null);
    setExpandedReport(null);
    try {
      const response = await fetch(webPath("/api/ai/research"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: instruction, scope, accountId }),
      });
      const payload = (await response.json().catch(() => null)) as ResearchPayload | { error?: string } | null;
      if (!response.ok || !payload || !("markdown" in payload)) {
        if (response.status === 504) {
          throw new Error("Mailbox research timed out while processing a broad query. Retry now; if it persists, narrow the identities, phrase, or date range.");
        }
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Mailbox research could not be completed.");
      }
      setResult(payload);
      if (panel) {
        setHistoryLoaded(false);
        setHistoryItems([]);
        setHistoryHasMore(false);
        setHistoryNextOffset(0);
        setSelectedHistory(null);
        setSelectedHistoryDetail(null);
        if (payload.historySaved === false) {
          setHistorySaveWarning("The report was generated, but its history record could not be saved. The report below is still available to download.");
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mailbox research could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(reset = false) {
    if (!panel || historyLoading) return;
    const offset = reset ? 0 : (historyNextOffset ?? historyItems.length);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetch(
        `${webPath("/api/ai/research/history")}?offset=${offset}&limit=50`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as HistoryResponse | { error?: string } | null;
      if (!response.ok || !payload || !("items" in payload)) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Research history could not be loaded.");
      }
      setHistoryItems((current) => reset ? payload.items : [...current, ...payload.items]);
      setHistoryHasMore(payload.hasMore);
      setHistoryNextOffset(payload.nextOffset);
      setHistoryLoaded(true);
      if (reset) {
        setSelectedHistory(null);
        setSelectedHistoryDetail(null);
        if (payload.items[0]) void openHistory(payload.items[0]);
      }
    } catch (reason) {
      setHistoryError(reason instanceof Error ? reason.message : "Research history could not be loaded.");
      setHistoryLoaded(true);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openHistory(item: ResearchHistorySummary) {
    setSelectedHistory(item);
    setSelectedHistoryDetail(null);
    setHistoryDetailLoading(true);
    setHistoryError("");
    try {
      const response = await fetch(webPath(`/api/ai/research/history/${item.id}`), { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { item?: ResearchHistoryDetail; error?: string } | null;
      if (!response.ok || !payload?.item) {
        throw new Error(payload?.error || "The saved research report could not be loaded.");
      }
      setSelectedHistoryDetail(payload.item);
    } catch (reason) {
      setHistoryError(reason instanceof Error ? reason.message : "The saved research report could not be loaded.");
    } finally {
      setHistoryDetailLoading(false);
    }
  }

  const titleId = panel ? "mail-research-panel-title" : "mail-research-title";
  const showingHistory = panel && activeTab === "history";
  const selectedHistoryView = selectedHistoryDetail || selectedHistory;
  const expandedResearch = expandedReport === "research" && result ? result : null;
  const expandedHistory = expandedReport === "history" && selectedHistoryDetail ? selectedHistoryDetail : null;

  const researchContent = (
    <section
      className={panel ? "research-modal research-panel" : "research-modal"}
      role={panel ? "region" : "dialog"}
      aria-modal={panel ? undefined : true}
      aria-labelledby={titleId}
    >
      <header className="research-modal-header">
        <span className="research-modal-icon"><Sparkles size={18} /></span>
        <div>
          <p className="eyebrow">FULL MAILBOX INTELLIGENCE</p>
          <h2 id={titleId}>S.I. Mail Research</h2>
        </div>
        {!panel && onClose ? (
          <button type="button" className="icon-button" onClick={onClose} disabled={loading} aria-label="Close S.I. Mail Research"><X size={18} /></button>
        ) : null}
      </header>

      {panel && !expandedResearch && !expandedHistory ? (
        <div className="research-workspace-tabs" role="tablist" aria-label="S.I. Mail Research views">
          <button type="button" role="tab" aria-selected={activeTab === "research"} className={activeTab === "research" ? "active" : ""} onClick={() => setActiveTab("research")}>
            <Sparkles size={15} /> Research
          </button>
          <button type="button" role="tab" aria-selected={activeTab === "history"} className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
            <History size={15} /> History
          </button>
        </div>
      ) : null}

      {expandedResearch || expandedHistory ? (
        <div className="research-expanded-view">
          <div className="research-expanded-toolbar">
            <div>
              <span className="research-expanded-kicker">{expandedResearch ? "CURRENT RESEARCH REPORT" : "SAVED RESEARCH REPORT"}</span>
              <strong>{(expandedResearch || expandedHistory)?.title}</strong>
              {expandedHistory ? <small>{formatResearchDate(expandedHistory.createdAt)}</small> : null}
            </div>
            <div className="research-expanded-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => downloadMarkdown(
                  (expandedResearch || expandedHistory)!.title,
                  (expandedResearch || expandedHistory)!.markdown,
                )}
              >
                <Download size={15} /> Download Markdown
              </button>
              <button
                type="button"
                className="icon-button research-expand-button"
                onClick={() => setExpandedReport(null)}
                aria-label="Collapse report to standard panel view"
                title="Collapse report"
              >
                <Minimize2 size={17} />
              </button>
            </div>
          </div>
          {(expandedResearch || expandedHistory)!.warnings.length ? (
            <div className="research-expanded-warnings" aria-label="Research warnings">
              {(expandedResearch || expandedHistory)!.warnings.map((warning) => (
                <p className="research-warning" key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          <MarkdownReport
            markdown={(expandedResearch || expandedHistory)!.markdown}
            className="research-expanded-document"
          />
        </div>
      ) : !showingHistory ? (
        <div className="research-modal-body">
          <div className="research-scope-row">
            <span><strong>Search scope</strong><small>The S.I. searches the complete server mailbox, not just messages currently loaded on screen.</small></span>
            <div className="research-scope-tabs" role="group" aria-label="Research mailbox scope">
              {(["inbox", "sent", "both"] as const).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={scope === item ? "active" : ""}
                  onClick={() => setScope(item)}
                  disabled={loading}
                >{item === "both" ? "Both" : item === "sent" ? "Sent" : "Inbox"}</button>
              ))}
            </div>
          </div>

          <label className="research-account-select">
            <span><strong>Mail account</strong><small>Search every active mailbox together or target one account.</small></span>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={loading}>
              <option value="all">All accounts</option>
              {accounts.filter((account) => account.active && account.imapReady).map((account) => (
                <option value={account.id} key={account.id}>{account.label} — {account.email}</option>
              ))}
            </select>
          </label>

          <label className="research-query">
            <span>Query or instruction</span>
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Example: Compile every email sent to clientonboarding@coinbase.com into one chronological document."
              maxLength={2000}
              disabled={loading}
            />
            <small>Ask for collections, searches, chronologies, summaries, comparisons, trends, decisions, deadlines, or executive reports.</small>
          </label>

          {!result ? (
            <div className="research-examples">
              <strong>Examples</strong>
              <div>
                {examples.map((example) => (
                  <button type="button" key={example} onClick={() => setQuery(example)} disabled={loading}>{example}</button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <div className="research-error" role="alert">{error}</div> : null}
          {historySaveWarning ? <div className="research-warning" role="status">{historySaveWarning}</div> : null}

          {result ? (
            <div className="research-result">
              <div className="research-result-summary">
                <span><FileText size={16} /><strong>{result.title}</strong></span>
                <div>
                  <b>{result.matched}</b><small>matched</small>
                  <b>{result.included}</b><small>included</small>
                  <b>{result.mode === "collection" ? "Collection" : "Report"}</b><small>output</small>
                </div>
                {panel ? (
                  <button
                    type="button"
                    className="icon-button research-expand-button"
                    onClick={() => setExpandedReport("research")}
                    aria-label="Expand report to full panel view"
                    title="Expand report"
                  >
                    <Maximize2 size={16} />
                  </button>
                ) : null}
              </div>
              {result.warnings.map((warning) => <p className="research-warning" key={warning}>{warning}</p>)}
              <MarkdownReport markdown={result.markdown} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="research-modal-body research-history-body">
          <div className="research-history-heading">
            <span>
              <strong>Saved research</strong>
              <small>Queries and generated Markdown reports are retained for your S.I.-Mail account.</small>
            </span>
            <button type="button" className="secondary-button" onClick={() => void loadHistory(true)} disabled={historyLoading}>
              <RefreshCw size={14} className={historyLoading ? "spin" : ""} /> Refresh
            </button>
          </div>

          {historyError ? <div className="research-error" role="alert">{historyError}</div> : null}

          <div className="research-history-layout">
            <aside className="research-history-list" aria-label="Saved research queries">
              {historyLoading && !historyItems.length ? (
                <div className="research-history-empty"><LoaderCircle className="spin" size={20} /><span>Loading saved research…</span></div>
              ) : historyItems.length ? (
                <>
                  {historyItems.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={selectedHistory?.id === item.id ? "research-history-item research-history-item--active" : "research-history-item"}
                      onClick={() => void openHistory(item)}
                    >
                      <span className="research-history-item-top">
                        <strong>{item.title}</strong>
                        <time>{formatResearchDate(item.createdAt)}</time>
                      </span>
                      <span className="research-history-query">{item.query}</span>
                      <span className="research-history-meta">
                        <b>{item.requestedScope === "both" ? "Inbox + Sent" : item.requestedScope === "sent" ? "Sent" : "Inbox"}</b>
                        <em>{item.mode === "collection" ? "Collection" : "Report"}</em>
                        <i>{item.matched} matched</i>
                        {item.warnings.length ? <span className="research-history-warning-badge">{item.warnings.length} warning{item.warnings.length === 1 ? "" : "s"}</span> : null}
                      </span>
                    </button>
                  ))}
                  {historyHasMore ? (
                    <button type="button" className="research-history-more" onClick={() => void loadHistory(false)} disabled={historyLoading}>
                      {historyLoading ? <><LoaderCircle className="spin" size={13} /> Loading…</> : "Load older research"}
                    </button>
                  ) : (
                    <div className="research-history-end">All saved research loaded</div>
                  )}
                </>
              ) : (
                <div className="research-history-empty"><History size={22} /><strong>No saved research yet</strong><span>Completed research queries and Markdown reports will appear here.</span></div>
              )}
            </aside>

            <section className="research-history-preview" aria-label="Saved research report">
              {selectedHistoryView ? (
                <>
                  <header>
                    <span><FileText size={16} /><strong>{selectedHistoryView.title}</strong></span>
                    <div className="research-history-header-actions">
                      <time>{formatResearchDate(selectedHistoryView.createdAt)}</time>
                      {selectedHistoryDetail ? (
                        <button
                          type="button"
                          className="icon-button research-expand-button"
                          onClick={() => setExpandedReport("history")}
                          aria-label="Expand saved report to full panel view"
                          title="Expand report"
                        >
                          <Maximize2 size={15} />
                        </button>
                      ) : null}
                    </div>
                  </header>
                  <div className="research-history-query-card">
                    <span>Original query</span>
                    <p>{selectedHistoryView.query}</p>
                  </div>
                  <div className="research-history-stats">
                    <span><b>{selectedHistoryView.matched}</b><small>matched</small></span>
                    <span><b>{selectedHistoryView.included}</b><small>included</small></span>
                    <span><b>{selectedHistoryView.mode === "collection" ? "Collection" : "Report"}</b><small>output</small></span>
                    <span><b>{selectedHistoryView.model || "Mailbox"}</b><small>model</small></span>
                  </div>
                  {selectedHistoryView.warnings.length ? (
                    <div className="research-history-warnings" aria-label="Research warnings">
                      {selectedHistoryView.warnings.map((warning) => <p className="research-warning" key={warning}>{warning}</p>)}
                    </div>
                  ) : null}
                  {historyDetailLoading ? (
                    <div className="research-history-preview-loading"><LoaderCircle className="spin" size={20} /> Loading Markdown report…</div>
                  ) : selectedHistoryDetail ? (
                    <MarkdownReport markdown={selectedHistoryDetail.markdown} className="research-history-document" />
                  ) : (
                    <div className="research-history-preview-loading">Select the report again to retry loading its Markdown.</div>
                  )}
                </>
              ) : (
                <div className="research-history-empty"><FileText size={24} /><strong>Select a saved query</strong><span>The generated Markdown report will open here.</span></div>
              )}
            </section>
          </div>
        </div>
      )}

      {!expandedResearch && !expandedHistory ? <footer className="research-modal-footer">
        <span><Bot size={14} /> Research never sends, deletes, or modifies email.</span>
        {!showingHistory ? (
          <div>
            {result ? <button type="button" className="secondary-button" onClick={() => { setResult(null); setError(""); setHistorySaveWarning(""); }} disabled={loading}>New research</button> : null}
            {result ? <button type="button" className="secondary-button" onClick={() => downloadMarkdown(result.title, result.markdown)}><Download size={15} /> Download Markdown</button> : null}
            <button type="button" className="primary-button" onClick={() => void runResearch()} disabled={loading || query.trim().length < 3}>
              {loading ? <><LoaderCircle className="spin" size={15} /> Researching mailbox…</> : <><Search size={15} /> Run research</>}
            </button>
          </div>
        ) : (
          <div>
            {selectedHistoryDetail ? (
              <button type="button" className="secondary-button" onClick={() => downloadMarkdown(selectedHistoryDetail.title, selectedHistoryDetail.markdown)}>
                <Download size={15} /> Download Markdown
              </button>
            ) : null}
            <button type="button" className="primary-button" onClick={() => setActiveTab("research")}><Sparkles size={15} /> New research</button>
          </div>
        )}
      </footer> : null}
    </section>
  );

  if (panel) return researchContent;

  return (
    <div className="research-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose?.();
    }}>
      {researchContent}
    </div>
  );
}

export function MailResearchModal({
  open,
  defaultScope,
  defaultAccountId = "all",
  onClose,
}: {
  open: boolean;
  defaultScope: ResearchScope;
  defaultAccountId?: string;
  onClose: () => void;
}) {
  return <MailResearchSurface open={open} defaultScope={defaultScope} defaultAccountId={defaultAccountId} onClose={onClose} />;
}

export function MailResearchPanel({
  defaultScope = "both",
  defaultAccountId = "all",
}: {
  defaultScope?: ResearchScope;
  defaultAccountId?: string;
}) {
  return <MailResearchSurface open defaultScope={defaultScope} defaultAccountId={defaultAccountId} panel />;
}
