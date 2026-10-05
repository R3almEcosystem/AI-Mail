"use client";

import { useEffect, useState } from "react";
import { Bot, Download, FileText, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { webPath } from "@/lib/web-path";

type ResearchScope = "inbox" | "sent" | "both";

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

export function MailResearchModal({
  open,
  defaultScope,
  onClose,
}: {
  open: boolean;
  defaultScope: ResearchScope;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ResearchScope>(defaultScope);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setScope(defaultScope);
    setError("");
  }, [defaultScope, open]);

  if (!open) return null;

  async function runResearch() {
    const instruction = query.trim();
    if (instruction.length < 3 || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(webPath("/api/ai/research"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: instruction, scope }),
      });
      const payload = (await response.json().catch(() => null)) as ResearchResult | { error?: string } | null;
      if (!response.ok || !payload || !("markdown" in payload)) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Mailbox research could not be completed.");
      }
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mailbox research could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  function downloadResult() {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFilename(result.title);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="research-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose();
    }}>
      <section className="research-modal" role="dialog" aria-modal="true" aria-labelledby="mail-research-title">
        <header className="research-modal-header">
          <span className="research-modal-icon"><Sparkles size={18} /></span>
          <div>
            <p className="eyebrow">FULL MAILBOX INTELLIGENCE</p>
            <h2 id="mail-research-title">AI Mail Research</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={loading} aria-label="Close AI Mail Research"><X size={18} /></button>
        </header>

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

        <footer className="research-modal-footer">
          <span><Bot size={14} /> Research never sends, deletes, or modifies email.</span>
          <div>
            {result ? <button type="button" className="secondary-button" onClick={() => { setResult(null); setError(""); }} disabled={loading}>New research</button> : null}
            {result ? <button type="button" className="secondary-button" onClick={downloadResult}><Download size={15} /> Download Markdown</button> : null}
            <button type="button" className="primary-button" onClick={() => void runResearch()} disabled={loading || query.trim().length < 3}>
              {loading ? <><LoaderCircle className="spin" size={15} /> Researching mailbox…</> : <><Search size={15} /> Run research</>}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
