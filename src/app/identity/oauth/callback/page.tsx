"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Fingerprint, LoaderCircle, ShieldCheck } from "lucide-react";
import { mailIdentity, establishMailSession } from "@/lib/sovsi-browser";
import type { SovsiPortalChallenge, SovsiPortalVerified } from "@/lib/sovsiPortal";
import { SovsiAuthShell } from "@/components/sovsi-auth-shell";
import styles from "@/components/sovsi-auth.module.css";

export default function Callback() {
  // OAuth codes are one-use. StrictMode must not redeem the same code twice.
  const started = useRef(false);
  const [challenge,setChallenge] = useState<SovsiPortalChallenge|null>(null);
  const [error,setError] = useState("");
  const [code,setCode] = useState("");
  const [busy,setBusy] = useState(false);
  const [completing,setCompleting] = useState(true);

  async function finish(result:SovsiPortalVerified) {
    // The server validates signed SOVSI client, AAL2, current portal grant,
    // existing local-account link and its independently assigned roles.
    await establishMailSession(result.session);
    window.location.replace(result.returnTo);
  }

  useEffect(()=>{
    if(started.current)return;
    started.current=true;
    void mailIdentity.complete().then(result=>{
      if(result.kind==="challenge"){
        setChallenge(result);
        setCompleting(false);
      }else{
        return finish(result);
      }
    }).catch(()=>{
      setError("The SOVSI ID sign-in or AI-Mail account linking check could not be completed. Restart the secure sign-in.");
      setCompleting(false);
    });
  },[]);

  async function verify(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!challenge||busy||!/^[0-9]{6}$/.test(code))return;
    setBusy(true);
    setError("");
    try {
      await finish(await challenge.verify(code));
    }catch {
      // Verification is a one-use operation. A failed attempt requires a
      // new, fully validated authorization and challenge.
      setChallenge(null);
      setError("The authenticator code or workspace access could not be verified. Restart sign-in.");
    }finally{
      setBusy(false);
      setCode("");
    }
  }

  return <SovsiAuthShell>
    <section className={styles.card} aria-labelledby="sovsi-callback-title">
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>
          {challenge?<Fingerprint size={25} aria-hidden="true"/>:<ShieldCheck size={25} aria-hidden="true"/>}
        </span>
        <span className={styles.verifiedPill}><span aria-hidden="true"/> SOVSI ID · SECURE</span>
      </div>
      <p className={styles.eyebrow}>ASSIST MAIL / IDENTITY VERIFICATION</p>
      <h2 id="sovsi-callback-title">{challenge?"Verify your authenticator":error?"Sign-in needs attention":"Confirming access…"}</h2>
      <p className={styles.cardLead}>
        {challenge
          ?"Use the six-digit code from your existing SOVSI ID authenticator. No additional enrollment is required."
          :error
            ?"No mailbox permissions have been changed. You can restart the sign-in safely."
            :"Verifying your SOVSI identity, authenticator assurance and existing ASSIST Mail account."}
      </p>

      {challenge&&<form className={styles.codeForm} onSubmit={verify}>
        <label htmlFor="sovsi-mail-totp">Six-digit authenticator code</label>
        <input id="sovsi-mail-totp" className={styles.codeInput}
          value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}
          inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code"
          maxLength={6} required aria-invalid={Boolean(error)}/>
        <button className={styles.cta} type="submit" disabled={busy||code.length!==6} aria-busy={busy}>
          <span className={styles.ctaContent}>
            {busy?<LoaderCircle size={18} className={styles.spinner} aria-hidden="true"/>:<CheckCircle2 size={18} aria-hidden="true"/>}
            {busy?"Verifying authenticator…":"Verify and open ASSIST Mail"}
          </span>
          <ArrowRight size={18} aria-hidden="true"/>
        </button>
      </form>}

      {completing&&!error&&!challenge&&<div className={styles.identitySummary} role="status" aria-live="polite">
        <div className={styles.summaryRow}><LoaderCircle size={20} className={styles.spinner} aria-hidden="true"/> Completing your protected SOVSI ID session…</div>
      </div>}
      {error&&<div className={styles.alert} role="alert"><AlertTriangle size={18} aria-hidden="true"/>{error}</div>}
      <div className={styles.helpDivider}>IDENTITY ASSISTANCE</div>
      <div className={styles.helpLinks}>
        <a className={styles.textLink} href="/login" onClick={()=>challenge?.cancel()}>
          <ArrowLeft size={13} aria-hidden="true"/> Restart sign-in
        </a>
        <a className={styles.textLink} href="https://auth.sovsi.xyz/security"
          target="_blank" rel="noopener noreferrer">Manage authenticator</a>
      </div>
      <p className={styles.disclaimer}>Only the verified SOVSI ID session and your pre-existing AI-Mail account permissions determine access. Codes and credentials are never placed in a destination URL.</p>
    </section>
  </SovsiAuthShell>;
}
