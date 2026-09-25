import { NextRequest, NextResponse } from "next/server";
import { aiConfiguration, analyzeMail } from "@/lib/ai";
import { getMail } from "@/lib/mail";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/auth-policy";
import { readAiRequest } from "@/lib/ai-request";
import { apiError, privateHeaders } from "@/lib/api-error";
export const maxDuration=60;
const demoResponses={
  summarize:"Demo summary: confirm the requested deliverable, owner, and timing. This is simulated analysis.",
  draft:"Thank you for the update. I will review the outstanding items and confirm the next steps.\n\nThis is a demonstration draft, not a sent message.",
  prioritize:"DEMO — Review the request and confirm any deadline before assigning a priority.",
  extract:"Demo checklist: confirm the deliverable, identify an owner, verify the deadline, prepare a response.",
} as const;
export async function POST(request:NextRequest) {
  try {
    const user=await requireCapability("ai:use",request);
    if(!can(user.role,"mail:read"))throw new Error("FORBIDDEN");
    let input;
    try{input=await readAiRequest(request);}catch{return NextResponse.json({error:"Invalid AI request. Supply an INBOX message UID, not message content."},{status:400,headers:privateHeaders});}
    if(user.demo)return NextResponse.json({text:demoResponses[input.action],demo:true,model:null,uid:input.uid},{headers:privateHeaders});
    if(!aiConfiguration().configured)return NextResponse.json({error:"AI processing is not configured."},{status:503,headers:privateHeaders});
    // Current application exposes its configured shared mailbox. No caller-selected account or folder.
    const message=await getMail(input.uid,"INBOX");
    const result=await analyzeMail(input.action,message,input.instructions);
    return NextResponse.json({text:result.text,usage:result.usage,truncated:result.truncated,demo:false,uid:input.uid,model:aiConfiguration().model},{headers:privateHeaders});
  }catch(error){return apiError(error,"AI processing failed. No generated result is available.");}
}
