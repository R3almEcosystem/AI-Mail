import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LoginPanel } from "@/components/login-panel";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-copy">
          <Link href="/" className="brand-lockup brand-lockup--large" aria-label="r3alm AI-Mail home">
            <span className="brand-mark" aria-hidden="true">r3</span>
            <span><strong>r3alm</strong><small>AI-MAIL</small></span>
          </Link>
          <p className="eyebrow eyebrow--light">EXECUTIVE INTELLIGENCE</p>
          <h1>Your inbox,<br />made decisive.</h1>
          <p>A secure operating console for business-critical email, AI-assisted triage, and faster executive response.</p>
        </div>
        <div className="login-security-note"><ShieldCheck size={18} /><span>Role-based access · Signed sessions · Private by design</span></div>
      </section>
      <section className="login-form-panel"><LoginPanel /></section>
    </main>
  );
}
