"use client";
import { createSovsiPortal } from './sovsiPortal';
// Keep tokens in memory only. PKCE state survives the central authorization redirect.
const ephemeral=new Map<string,string>();
const storage={getItem:(k:string)=>k.includes('-transaction-')?sessionStorage.getItem(k):ephemeral.get(k)??null,
 setItem:(k:string,v:string)=>{if(k.includes('-transaction-'))sessionStorage.setItem(k,v);else ephemeral.set(k,v);},
 removeItem:(k:string)=>{sessionStorage.removeItem(k);ephemeral.delete(k);},clear:()=>ephemeral.clear(),key:()=>null,length:0};
export const mailIdentity=createSovsiPortal({portalKey:'ai-mail',canonicalOrigin:'https://ai-mail.sovsi.xyz',defaultReturnTo:'/inbox',allowedReturnPaths:['/inbox','/admin'],storage});
export async function establishMailSession(tokens:{access_token:string;refresh_token:string}){
 const r=await fetch('/api/auth/sovsi-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tokens),cache:'no-store'});
 if(!r.ok)throw Error('Your existing mail account is not linked or authorized.');
 ephemeral.clear();
}
