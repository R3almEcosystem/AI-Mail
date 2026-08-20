import Link from "next/link";
import { ArrowRight, Bot, Check, Inbox, LockKeyhole, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import { LoginPanel } from "@/components/login-panel";
import { OAuthResume } from "@/components/oauth-resume";
import { webPath } from "@/lib/web-path";

const features = [
  { icon: Inbox, title: "Priority inbox", text: "Turn noisy mail into a focused queue of decisions, deadlines, and follow-ups." },
  { icon: Bot, title: "AI assistance", text: "Summarize threads, extract actions, and draft considered responses with OpenAI." },
  { icon: Users, title: "Team governance", text: "Assign roles, control access, configure policies, and review every admin change." },
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <OAuthResume />
      <header className="landing-nav">
        <Link href={webPath("/")} className="brand-lockup landing-brand" aria-label="r3alm AI-Mail home"><span className="brand-mark" aria-hidden="true">r3</span><span><strong>r3alm</strong><small>AI-MAIL</small></span></Link>
        <nav aria-label="Public navigation"><a href="#platform">Platform</a><a href="#security">Security</a><a href="#access">Access</a></nav>
        <Link href={webPath("/login")} className="landing-signin">Sign in <ArrowRight size={15} /></Link>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-pill"><Sparkles size={14} /> MAIL INTELLIGENCE FOR DECISIVE TEAMS</span>
          <h1>Your inbox is full.<br /><em>Your attention shouldn’t be.</em></h1>
          <p>AI-Mail turns executive email into a secure command center—prioritized, summarized, and ready for action.</p>
          <div className="landing-actions"><a href="#access" className="landing-primary">Open the workspace <ArrowRight size={17} /></a><a href="#platform" className="landing-secondary">See how it works</a></div>
          <div className="landing-proof"><span><Check size={14} /> Human-approved replies</span><span><Check size={14} /> Private server credentials</span><span><Check size={14} /> Role-based controls</span></div>
        </div>
        <div className="landing-product" aria-label="AI-Mail product preview">
          <div className="product-window">
            <div className="product-window-bar"><span /><span /><span /><b>AI-Mail · Executive Inbox</b></div>
            <div className="product-window-body">
              <aside><i>r3</i><span className="active"><Inbox size={15} /> Inbox <b>7</b></span><span><Bot size={15} /> AI Rules</span><span><Users size={15} /> Users</span></aside>
              <div className="product-mail-list"><small>PRIORITY QUEUE</small><div className="mock-message active"><i>NC</i><span><b>North Capital</b><strong>Term sheet follow-up</strong><em>Three open decisions need your review…</em></span></div><div className="mock-message"><i>MC</i><span><b>Maya Chen</b><strong>Operating plan ready</strong><em>Updated forecast and next steps…</em></span></div><div className="mock-message"><i>JL</i><span><b>Jordan Lee</b><strong>Client approval</strong><em>The revised scope has been approved…</em></span></div></div>
              <div className="product-ai-card"><span><Sparkles size={16} /> AI BRIEF</span><h3>3 decisions, 1 deadline</h3><p>Confirm the renewal range, approve the diligence timeline, and assign a response owner before 10:00 AM.</p><button>Draft response <ArrowRight size={13} /></button></div>
            </div>
          </div>
          <div className="floating-security"><ShieldCheck size={18} /><span><strong>Protected by design</strong><small>Server-side credentials</small></span></div>
        </div>
      </section>

      <section className="landing-feature-section" id="platform">
        <div className="section-heading"><p className="eyebrow">ONE OPERATING VIEW</p><h2>From incoming message to confident action.</h2><p>Everything important stays visible. Everything sensitive stays controlled.</p></div>
        <div className="landing-feature-grid">{features.map((feature) => { const Icon = feature.icon; return <article key={feature.title}><span><Icon size={21} /></span><h3>{feature.title}</h3><p>{feature.text}</p><a href="#access">Explore <ArrowRight size={14} /></a></article>; })}</div>
      </section>

      <section className="landing-security" id="security">
        <div><p className="eyebrow eyebrow--light">TRUSTED OPERATIONS</p><h2>Control that scales with the team.</h2><p>Signed sessions, server-only secrets, role-based permissions, and a complete audit trail make AI-Mail ready for responsible administration.</p><div className="security-points"><span><LockKeyhole size={17} /><b>Five access roles</b><small>Super Admin through Viewer</small></span><span><Zap size={17} /><b>Central policy</b><small>AI, mail, access, and session controls</small></span></div></div>
        <div className="role-stack"><span><i>BO</i><b>Bernie O’Neill</b><em>Super Admin</em></span><span><i>MC</i><b>Maya Chen</b><em>Admin</em></span><span><i>JE</i><b>Jordan Ellis</b><em>Manager</em></span></div>
      </section>

      <section className="landing-access" id="access">
        <div className="access-copy"><p className="eyebrow">YOUR WORKSPACE</p><h2>Make the inbox work for you.</h2><p>Use the demo account for a complete tour of AI-Mail and its Admin Console. No setup required.</p><ul><li><Check size={15} /> Executive inbox and AI workflows</li><li><Check size={15} /> User, role, and status management</li><li><Check size={15} /> Organization, AI, mail, and security settings</li></ul></div>
        <LoginPanel compact />
      </section>
      <footer className="landing-footer"><span>© 2026 r3alm. AI-Mail executive intelligence.</span><span>Private by design · Human in control</span></footer>
    </main>
  );
}
