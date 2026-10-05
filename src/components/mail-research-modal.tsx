"use client";

import { useEffect, useState } from "react";
import { Bot, Download, FileText, History, LoaderCircle, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { webPath } from "@/lib/web-path";

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

function MailResearchSurface({
  open,
  defaultScope,
  onClose,
  panel = false,
}: {
  open: boolean;
  defaultScope: ResearchScope;
  onClose?: () => void;
  panel?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ResearchScope>(defaultScope);
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

  useEffect(() => {
    if (!open) return;
    setScope(defaultScope);
    setError("");
  }, [defaultScope, open]);

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
    try {
      const response = await fetch(webPath("/api/ai/research"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: instruction, scope }),
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
          <h2 id={titleId}>AI Mail Research</h2>
        </div>
        {!panel && onClose ? (
          <button type="button" className="icon-button" onClick={onClose} disabled={loading} aria-label="Close AI Mail Research"><X size={18} /></button>
        ) : null}
      </header>

      {panel ? (
        <div className="research-workspace-tabs" role="tablist" aria-label="AI Mail Research views">
          <button type="button" role="tab" aria-selected={activeTab === "research"} className={activeTab === "research" ? "active" : ""} onClick={() => setActiveTab("research")}>
            <Sparkles size={15} /> Research
          </button>
          <button type="button" role="tab" aria-selected={activeTab === "history"} className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
            <History size={15} /> History
          </button>
        </div>
      ) : null}

      {!showingHistory ? (
        <div className="research-modal-body">
          <div className="research-scope-row">
            <span><strong>Search scope</strong><small>The AI searches the complete server mailbox, not just messages currently loaded on screen.</small></span>
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
              </div>
              {result.capped ? <p className="research-warning">This search found more matching messages than one research request can safely process. The newest matches are included; narrow the query or date range for older results.</p> : null}
              {result.excluded > 0 ? <p className="research-warning">{result.excluded} matching message(s) were not included in the generated output because of processing or security limits.</p> : null}
              <pre className="research-document">{result.markdown}</pre>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="research-modal-body research-history-body">
          <div className="research-history-heading">
            <span>
              <strong>Saved research</strong>
              <small>Queries and generated Markdown reports are retained for your AI-Mail account.</small>
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
                    <time>{formatResearchDate(selectedHistoryView.createdAt)}</time>
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
                  {historyDetailLoading ? (
                    <div className="research-history-preview-loading"><LoaderCircle className="spin" size={20} /> Loading Markdown report…</div>
                  ) : selectedHistoryDetail ? (
                    <pre className="research-document research-history-document">{selectedHistoryDetail.markdown}</pre>
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

      <footer className="research-modal-footer">
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
      </footer>
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
  onClose,
}: {
  open: boolean;
  defaultScope: ResearchScope;
  onClose: () => void;
}) {
  return <MailResearchSurface open={open} defaultScope={defaultScope} onClose={onClose} />;
}

export function MailResearchPanel({
  defaultScope = "both",
}: {
  defaultScope?: ResearchScope;
}) {
  return <MailResearchSurface open defaultScope={defaultScope} panel />;
}
