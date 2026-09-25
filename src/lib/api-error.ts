import { NextResponse } from "next/server";
import { EmailSecurityPolicyError } from "../security/email-security";
import { AiDisclosureError } from "../security/ai-disclosure";
export const privateHeaders={"Cache-Control":"private, no-store"};
export function apiError(error:unknown,fallback="The operation could not be completed.") {
  if(error instanceof AiDisclosureError)return NextResponse.json({code:error.code,error:"AI processing was withheld because the message contains high-risk or sensitive-data indicators, or required attachment scanning is incomplete. No AI result is available."},{status:422,headers:privateHeaders});
  if(error instanceof EmailSecurityPolicyError)return NextResponse.json({error:error.message,code:error.code,security:error.assessment},{status:422,headers:privateHeaders});
  const code=error instanceof Error?error.message:"";
  if(code==="UNAUTHORIZED")return NextResponse.json({error:"Authentication required."},{status:401,headers:privateHeaders});
  if(code==="FORBIDDEN")return NextResponse.json({error:"You do not have permission to perform this operation."},{status:403,headers:privateHeaders});
  if(code==="AUTH_UNAVAILABLE")return NextResponse.json({error:"Authentication service is unavailable. Access remains blocked."},{status:503,headers:privateHeaders});
  return NextResponse.json({error:fallback},{status:502,headers:privateHeaders});
}
