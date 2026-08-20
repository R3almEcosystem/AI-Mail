"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Sparkles } from "lucide-react";

export function LoginPanel({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("bernie@r3alm.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"credentials" | "demo" | null>(null);

  function destination() {
    if (typeof window === "undefined") return "/app";
    const target = new URLSearchParams(window.location.search).get("next") || "/app";
    return target.startsWith("/") && !target.startsWith("//") ? target : "/app";
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("credentials");
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) {
      window.location.assign(destination());
      return;
    }
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(result?.error || "Unable to sign in.");
    setLoading(null);
  }

  async function signInDemo() {
    setLoading("demo");
    setError("");
    const response = await fetch("/api/auth/demo", { method: "POST" });
    if (response.ok) {
      window.location.assign(destination());
      return;
    }
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(result?.error || "Demo access is unavailable.");
    setLoading(null);
  }

  return (
    <div className={compact ? "login-card login-card--compact" : "login-card"}>
      <div className="login-icon"><KeyRound size={21} /></div>
      <p className="eyebrow">SECURE WORKSPACE</p>
      <h2>Welcome back</h2>
      <p className="muted">Sign in to manage your mail intelligence workspace.</p>
      <form onSubmit={signIn}>
        <label htmlFor={compact ? "landing-email" : "email"}>Work email</label>
        <input id={compact ? "landing-email" : "email"} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor={compact ? "landing-password" : "password"}>Password</label>
        <input id={compact ? "landing-password" : "password"} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
        <button className="primary-button primary-button--wide" type="submit" disabled={loading !== null}>
          <span>{loading === "credentials" ? "Signing in…" : "Sign in"}</span>
          {loading === "credentials" ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}
        </button>
      </form>
      <div className="login-divider"><span>or explore the workspace</span></div>
      <button className="demo-login-button" type="button" onClick={signInDemo} disabled={loading !== null}>
        <span className="demo-avatar">BO</span>
        <span><strong>Continue as Bernie</strong><small>Demo Super Admin</small></span>
        {loading === "demo" ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <p className="login-help">Demo changes are simulated and do not affect production.</p>
    </div>
  );
}
