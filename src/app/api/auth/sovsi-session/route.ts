import { NextResponse } from "next/server";
import { createSessionToken, SESSION_NAME } from "@/lib/auth";
import { createFederatedSession,consumeLoginAttempt } from "@/lib/session-store";
import { verifySovsiAccess } from "@/lib/sovsi-server";
import { isSameOriginRequest } from "@/lib/auth-policy";
import { privateHeaders } from "@/lib/api-error";
export async function POST(request:Request){
 if(!isSameOriginRequest(request)||request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Forbidden'},{status:403,headers:privateHeaders});
 try{
  const raw=await request.text();if(raw.length>24000)throw Error('UNAUTHORIZED');
  const input=JSON.parse(raw);if(typeof input.access_token!=='string'||typeof input.refresh_token!=='string'||input.refresh_token.length>4096)throw Error('UNAUTHORIZED');
  const identity=await verifySovsiAccess(input.access_token,'ai-mail');
  if(!await consumeLoginAttempt(identity.subject))return NextResponse.json({error:'Try again later.'},{status:429,headers:privateHeaders});
  const session=await createFederatedSession(identity,input);
  const token=await createSessionToken(session.user,session.duration,session.sessionId);if(!token)throw Error('AUTH_UNAVAILABLE');
  const response=NextResponse.json({ok:true},{headers:privateHeaders});
  response.cookies.set(SESSION_NAME,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:session.duration});return response;
 }catch{return NextResponse.json({error:'SOVSI ID or the existing workspace account could not be verified.'},{status:403,headers:privateHeaders});}
}
