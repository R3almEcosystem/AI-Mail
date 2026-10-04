import { NextRequest, NextResponse } from "next/server";
import { testAiConnection } from "@/lib/ai";
import { privateHeaders } from "@/lib/api-error";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  if (!process.env.VERCEL_URL || host !== process.env.VERCEL_URL) {
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
