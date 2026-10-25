"use client";
import { useEffect,useRef,useState,type FormEvent } from 'react';
import { mailIdentity,establishMailSession } from '@/lib/sovsi-browser';
import type { SovsiPortalChallenge,SovsiPortalVerified } from '@/lib/sovsiPortal';
export default function Callback(){
 const started=useRef(false),[challenge,setChallenge]=useState<SovsiPortalChallenge|null>(null),[error,setError]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false);
 async function finish(result:SovsiPortalVerified){await establishMailSession(result.session);window.location.replace(result.returnTo);}
 useEffect(()=>{if(started.current)return;started.current=true;mailIdentity.complete().then(result=>result.kind==='challenge'?setChallenge(result):finish(result)).catch(()=>setError('SOVSI sign-in could not be completed. Restart from the sign-in page.'));},[]);
 async function verify(event:FormEvent){event.preventDefault();if(!challenge)return;setBusy(true);try{await finish(await challenge.verify(code));}catch{setChallenge(null);setError('The authenticator verification failed. Restart sign-in.');}finally{setBusy(false);setCode('');}}
 return <main className="login-page"><section className="login-card"><h1>SOVSI ID</h1>{challenge?<form onSubmit={verify}><label htmlFor="totp">Your SOVSI authenticator code</label><input id="totp" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required/><button disabled={busy||code.length!==6}>Verify and open mail</button></form>:!error&&<p>Verifying your workspace access…</p>}{error&&<p role="alert">{error}</p>}<a href="/login">Return to sign in</a></section></main>;
}
