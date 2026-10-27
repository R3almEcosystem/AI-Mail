"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, ExternalLink, Fingerprint, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { mailIdentity } from "@/lib/sovsi-browser";
import { SOVSI_MAIL_ORIGIN } from "@/components/sovsi-auth-shell";
import styles from "@/components/sovsi-auth.module.css";

export function LoginPanel({compact=false}:{compact?:boolean}){
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function signIn(){
    if(busy)return;
    setBusy(true);
    setError("");
    try {
      // Preserve only explicitly supported, local destinations from the
      // authentication-required redirect. Do not forward arbitrary URLs.
      const requested=new URLSearchParams(window.location.search).get("next");
      const destination=requested==="/admin"?"/admin":"/inbox";
      if(window.location.origin!==SOVSI_MAIL_ORIGIN){
        // OAuth client callback is registered on one canonical origin.
        // Do not initiate authorization from a Vercel or legacy-domain alias.
        window.location.replace(SOVSI_MAIL_ORIGIN+"/login?next="+encodeURIComponent(destination));
        return;
      }
      await mailIdentity.begin(destination);
    }catch(e){
      setError(e instanceof Error?e.message:"SOVSI ID could not start sign-in. Please retry.");
      setBusy(false);
    }
  }

  return <div className={styles.card} data-testid="sovsi-mail-login">
    <div className={styles.cardHeader}>
      <span className={styles.cardIcon}><KeyRound size={25} aria-hidden="true"/></span>
      <span className={styles.verifiedPill}><span aria-hidden="true"/> CENTRAL SOVSI ID</span>
    </div>
    <p className={styles.eyebrow}>ASSIST MAIL / ACCOUNT ACCESS</p>
    <h2>Welcome to ASSIST Mail.</h2>
    <p className={styles.cardLead}>Your secure workspace begins with SOVSI ID. Use the account and authenticator you already enrolled—no separate mail password or second QR code.</p>

    <div className={styles.identitySummary}>
      <div className={styles.summaryRow}><ShieldCheck size={17} aria-hidden="true"/> SOVSI ID confirms your identity.</div>
      <div className={styles.summaryRow}><Fingerprint size={17} aria-hidden="true"/> Your existing authenticator provides AAL2 verification.</div>
      <div className={styles.summaryRow}><LockKeyhole size={17} aria-hidden="true"/> AI-Mail verifies your linked account and mailbox rights.</div>
    </div>

    <button className={styles.cta} type="button" aria-busy={busy} disabled={busy} onClick={()=>void signIn()}>
      <span className={styles.ctaContent}>
        {busy?<LoaderCircle size={19} className={styles.spinner} aria-hidden="true"/>:<ShieldCheck size={19} aria-hidden="true"/>}
        {busy?"Connecting securely…":"Continue with SOVSI ID"}
      </span>
      <ArrowRight size={19} aria-hidden="true"/>
    </button>

    {error&&<div className={styles.alert} role="alert"><AlertTriangle size={16} aria-hidden="true"/><span>{error}</span></div>}

    <div className={styles.helpDivider}>ACCOUNT ASSISTANCE</div>
    <nav className={styles.helpLinks} aria-label="Account assistance">
      <a className={styles.textLink} href="https://auth.sovsi.xyz/security" target="_blank" rel="noopener noreferrer">Manage authenticator <ExternalLink size={11} aria-hidden="true"/></a>
      <a className={styles.textLink} href="https://auth.sovsi.xyz/forgot" target="_blank" rel="noopener noreferrer">Recover SOVSI ID <ExternalLink size={11} aria-hidden="true"/></a>
    </nav>
    <p className={styles.disclaimer}>Your identity is verified by SOVSI ID. This application never grants mail access from a login alone; a separately linked, active workspace account is required.</p>
  </div>;
}
