import type { ReactNode } from "react";
import { Fingerprint, LockKeyhole, MailCheck2, ShieldCheck } from "lucide-react";
import styles from "./sovsi-auth.module.css";

export const SOVSI_MAIL_ORIGIN = "https://ai-mail.sovsi.xyz";

export function SovsiBrand({ subtle = false }: { subtle?: boolean }) {
  return <span className={subtle ? styles.brandSubtle : styles.brand} aria-label="SOVSI ID">
    <span className={styles.brandMark} aria-hidden="true">
      <svg viewBox="0 0 56 56" fill="none" focusable="false">
        <path d="M28 5.5 51.5 47H4.5L28 5.5Z" stroke="currentColor" strokeWidth="3.1" strokeLinejoin="round" />
        <path d="M27.8 15.5 31.2 37 43 44.5H13.4L24.5 37 27.8 15.5Z" fill="currentColor" opacity=".78" />
        <path d="M28 6v12M4.5 47l10.2-6M51.5 47l-10.2-6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" opacity=".45" />
      </svg>
    </span>
    <span className={styles.brandCopy}>
      <strong>SOVSI <em>ID</em></strong>
      <small>SOVEREIGN SUPER-INTELLIGENCE</small>
    </span>
  </span>;
}

/** Presentation only. Real security is the central issuer, PKCE callback and
 * independently verified AI-Mail session/role check on the server. */
export function SovsiAuthShell({ children }: { children: ReactNode }) {
  return <main className={styles.page}>
    <header className={styles.topbar}>
      <a href="https://sovsi.xyz" className={styles.brandLink} aria-label="SOVSI home">
        <SovsiBrand />
      </a>
      <div className={styles.topMeta}>
        <span className={styles.connectionPulse} aria-hidden="true" />
        <span>SECURE IDENTITY ACCESS</span>
        <span className={styles.topSeparator} aria-hidden="true" />
        <span>SOVSI.XYZ</span>
      </div>
    </header>

    <div className={styles.layout}>
      <section className={styles.story} aria-labelledby="sovsi-mail-story">
        <div className={styles.storyGrid} aria-hidden="true" />
        <div className={styles.orb} aria-hidden="true"><i/><i/><i/></div>
        <div className={styles.storyContent}>
          <p className={styles.kicker}><span className={styles.kickerLine}/> A.S.S.I.S.T. / COMMUNICATIONS</p>
          <h1 id="sovsi-mail-story">Intelligence in <span>every exchange.</span></h1>
          <p className={styles.storyLead}>Your private communications workspace. Connected mailboxes, responsible intelligence and clear human control—protected by your SOVSI identity.</p>
          <div className={styles.storySteps} aria-label="Secure access process">
            <div className={styles.step}><span className={styles.stepIcon}><Fingerprint size={19}/></span><div><b>01 / ONE IDENTITY</b><small>Use your existing SOVSI account</small></div></div>
            <div className={styles.step}><span className={styles.stepIcon}><ShieldCheck size={19}/></span><div><b>02 / VERIFIED ASSURANCE</b><small>Complete your enrolled authenticator check</small></div></div>
            <div className={styles.step}><span className={styles.stepIcon}><MailCheck2 size={19}/></span><div><b>03 / GOVERNED ACCESS</b><small>Keep independent mailbox and role permissions</small></div></div>
          </div>
        </div>
        <div className={styles.storyBottom}>
          <LockKeyhole size={16} aria-hidden="true"/>
          <span>IDENTITY IS NOT AUTHORIZATION. MAILBOX RIGHTS ARE CHECKED SEPARATELY.</span>
        </div>
      </section>

      <section className={styles.identityArea} aria-label="Sign in to ASSIST Mail">
        <div className={styles.identityContent}>
          <div className={styles.mobileBrand}><SovsiBrand subtle /></div>
          {children}
          <div className={styles.asideFooter}>
            <span>Protected by <b>SOVSI ID</b></span>
            <span aria-hidden="true">·</span>
            <a href="https://auth.sovsi.xyz/security" target="_blank" rel="noopener noreferrer">Account security</a>
            <span aria-hidden="true">·</span>
            <a href="https://sovsi.xyz" target="_blank" rel="noopener noreferrer">Corporate site</a>
          </div>
        </div>
      </section>
    </div>
    <footer className={styles.footer}>
      <span>© {new Date().getFullYear()} Sovereign Super-Intelligence</span>
      <span>ASSIST Mail · Secure communications</span>
    </footer>
  </main>;
}
