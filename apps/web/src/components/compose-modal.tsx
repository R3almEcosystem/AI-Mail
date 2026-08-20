"use client";

import { FormEvent, useEffect, useState } from "react";
import { Minimize2, Paperclip, Send, Sparkles, X } from "lucide-react";
import type { MailMessage } from "@/lib/types";

export function ComposeModal({
  open,
  replyTo,
  onClose,
  onSent,
}: {
  open: boolean;
  replyTo: MailMessage | null;
  onClose: () => void;
  onSent: (demo: boolean) => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTo(replyTo?.senderEmail || "");
    setSubject(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : "");
    setText("");
    setError("");
  }, [open, replyTo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    const response = await fetch("/api/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, text }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; demo?: boolean } | null;
    if (!response.ok) {
      setError(result?.error || "Unable to send the message.");
      setSending(false);
      return;
    }
    setSending(false);
    onSent(Boolean(result?.demo));
    onClose();
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget ? onClose() : undefined}>
      <form className="compose-modal" onSubmit={submit}>
        <header><strong>New message</strong><span><button type="button" aria-label="Minimize"><Minimize2 size={15} /></button><button type="button" onClick={onClose} aria-label="Close"><X size={16} /></button></span></header>
        <label><span>To</span><input type="email" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
        <label><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} required /></label>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Write your message…" required />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <footer>
          <button className="primary-button" type="submit" disabled={sending}><Send size={15} />{sending ? "Sending…" : "Send"}</button>
          <button type="button" className="compose-tool" aria-label="Attach file"><Paperclip size={17} /></button>
          <button type="button" className="compose-tool compose-tool--ai" aria-label="Write with AI"><Sparkles size={17} /></button>
        </footer>
      </form>
    </div>
  );
}

