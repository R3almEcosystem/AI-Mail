"use client";
import { useState } from 'react';
import { ArrowRight,KeyRound } from 'lucide-react';
import { mailIdentity } from '@/lib/sovsi-browser';
export function LoginPanel({compact=false}:{compact?:boolean}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function signIn(){setBusy(true);setError('');try{await mailIdentity.begin('/inbox');}catch(e){setError(e instanceof Error?e.message:'Unable to sign in.');setBusy(false);}}
 return <div className={compact?'login-card login-card--compact':'login-card'}><div className="login-icon"><KeyRound size={21}/></div><p className="eyebrow">ASSIST MAIL · SECURE WORKSPACE</p><h2>Welcome back</h2><p className="muted">Use your SOVSI ID and existing authenticator to open your mail workspace.</p><button className="primary-button primary-button--wide" disabled={busy} onClick={()=>void signIn()}>{busy?'Connecting…':'Continue with SOVSI ID'}<ArrowRight size={17}/></button>{error&&<p role="alert" className="form-error">{error}</p>}</div>;
}
