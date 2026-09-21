"use client";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Sparkles } from "lucide-react";
import { webPath } from "@/lib/web-path";
import { safeReturnPath } from "@/lib/auth-policy";

export function LoginPanel({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("bernie@r3alm.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"credentials" | "demo" | null>(null);
  const [demoEnabled, setDemoEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(webPath("/api/auth/demo"), { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : { enabled: false })
      .then(result => setDemoEnabled(result.enabled === true)).catch(() => undefined);
    return () => controller.abort();
  }, []);
  function destination() { return safeReturnPath(new URLSearchParams(window.location.search).get("next"), webPath("/inbox")); }
  async function submit(kind: "credentials" | "demo") {
    setLoading(kind); setError("");
    try {
      const response = await fetch(webPath(`/api/auth/${kind === "demo" ? "demo" : "login"}`), {
        method: "POST", ...(kind === "credentials" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) } : {}),
      });
      if (response.ok) { window.location.assign(destination()); return; }
      const result = await response.json().catch(() => null);
      setError(result?.error || "Unable to sign in.");
    } catch { setError("Unable to reach the sign-in service. Please retry."); }
    finally { setLoading(null); }
  }
  function signIn(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void submit("credentials"); }
  return (
    <div className={compact ? "login-card login-card--compact" : "login-card"}>
      <div className="login-icon"><KeyRound size={21} /></div>
      <p className="eyebrow">SECURE WORKSPACE</p><h2>Welcome back</h2>
      <p className="muted">Sign in with your individual workspace account.</p>
      <form onSubmit={signIn}>
        <label htmlFor={compact ? "landing-email" : "email"}>Work email</label>
        <input id={compact ? "landing-email" : "email"} type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
        <label htmlFor={compact ? "landing-password" : "password"}>Password</label>
        <input id={compact ? "landing-password" : "password"} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" required />
        <button className="primary-button primary-button--wide" type="submit" disabled={loading !== null}>
          <span>{loading === "credentials" ? "Signing in…" : "Sign in"}</span>{loading === "credentials" ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}
        </button>
      </form>
      {demoEnabled ? <><div className="login-divider"><span>or explore an isolated demo</span></div>
        <button className="demo-login-button" type="button" onClick={() => void submit("demo")} disabled={loading !== null}>
          <span className="demo-avatar">BO</span><span><strong>Continue as Bernie</strong><small>Isolated Demo Super Admin</small></span>
          {loading === "demo" ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
        </button><p className="login-help">Synthetic data only. No live email, AI, or database connections.</p></> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
