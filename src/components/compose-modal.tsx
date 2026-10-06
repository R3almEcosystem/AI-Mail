"use client";

import { FormEvent, useEffect, useState } from "react";
import { Minimize2, Paperclip, Send, Sparkles, X } from "lucide-react";
import type { MailAccountSummary, MailMessage } from "@/lib/types";
import { webPath } from "@/lib/web-path";
import { parseSendResult, unconfirmedDelivery } from "@/lib/send-result";

export function ComposeModal({
  open,
  replyTo,
  accounts,
  defaultAccountId,
  onClose,
  onSent,
}: {
  open: boolean;
  replyTo: MailMessage | null;
  accounts: MailAccountSummary[];
  defaultAccountId: string;
  onClose: () => void;
  onSent: (demo: boolean) => void;
}) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [findings, setFindings] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const preferredAccount = replyTo?.accountId || defaultAccountId;
    const sendable = accounts.find((account) => account.id === preferredAccount && account.active && account.smtpReady)
      || accounts.find((account) => account.primary && account.active && account.smtpReady)
      || accounts.find((account) => account.active && account.smtpReady);
    setAccountId(sendable?.id || preferredAccount || "primary");
    setTo(replyTo?.senderEmail || "");
    setSubject(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : "");
    setText("");
    setError("");
    setFindings([]);
  }, [accounts, defaultAccountId, open, replyTo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    setFindings([]);
    try {
      const response = await fetch(webPath("/api/mail/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text, accountId }),
        signal: AbortSignal.timeout(65_000),
      });
      const outcome = parseSendResult(response.ok, await response.json().catch(() => null));
      if (outcome.state !== "accepted") {
        setError(outcome.message);
        if (outcome.state === "rejected") setFindings(outcome.findings);
        return;
      }
      onSent(outcome.demo);
      onClose();
    } catch {
      setError(unconfirmedDelivery);
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => !sending && event.target === event.currentTarget ? onClose() : undefined}>
      <form className="compose-modal" onSubmit={submit}>
        <header><strong>New message</strong><span><button type="button" aria-label="Minimize"><Minimize2 size={15} /></button><button type="button" onClick={onClose} disabled={sending} aria-label="Close"><X size={16} /></button></span></header>
        <label><span>From</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={sending} required>
          {accounts.filter((account) => account.active && account.smtpReady).map((account) => (
            <option value={account.id} key={account.id}>{account.label} — {account.email}</option>
          ))}
        </select></label>
        <label><span>To</span><input type="email" value={to} onChange={(event) => setTo(event.target.value)} disabled={sending} required /></label>
        <label><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={sending} required /></label>
        <textarea value={text} onChange={(event) => setText(event.target.value)} disabled={sending} placeholder="Write your message…" required />
        {error ? <div className="form-error" role="alert"><p>{error}</p>{findings.length ? <ul>{findings.map((finding, index) => <li key={index}>{finding}</li>)}</ul> : null}</div> : null}
        <footer>
          <button className="primary-button" type="submit" disabled={sending}><Send size={15} />{sending ? "Sending…" : "Send"}</button>
          <button type="button" className="compose-tool" aria-label="Attach file"><Paperclip size={17} /></button>
          <button type="button" className="compose-tool compose-tool--ai" aria-label="Write with S.I."><Sparkles size={17} /></button>
        </footer>
      </form>
    </div>
  );
}
