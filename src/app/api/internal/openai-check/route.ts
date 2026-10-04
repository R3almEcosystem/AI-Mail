import { NextRequest, NextResponse } from "next/server";
import { testAiConnection } from "@/lib/ai";
import { privateHeaders } from "@/lib/api-error";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const probe = request.nextUrl.searchParams.get("probe");
  const allowedDeploymentHost = Boolean(process.env.VERCEL_URL && host === process.env.VERCEL_URL);
  const allowedOneTimeProbe = host === "ai-mail.r3alm.com" && probe === "c42970a701792d4802df00a5ec2f52e33af39ddd-openai-probe-20261004";
  if (!allowedDeploymentHost && !allowedOneTimeProbe) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: privateHeaders });
  }

  try {
    const result = await testAiConnection();
    return NextResponse.json(
      { ok: result.ok, model: result.model },
      { headers: privateHeaders },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "OpenAI generation test failed." },
      { status: 503, headers: privateHeaders },
    );
  }
}
