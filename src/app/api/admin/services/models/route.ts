import { NextResponse } from "next/server";
import { listOpenAiModels } from "@/lib/ai";
import { getSettings } from "@/lib/admin-data";
import { requireCapability } from "@/lib/session";
import { privateHeaders } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const user = await requireCapability("admin:manage");
    const [models, settings] = await Promise.all([
      listOpenAiModels({ actorId: user.id, actorName: user.name }),
      getSettings(),
    ]);
    return NextResponse.json(
      { models, selected: settings.aiModel },
      { headers: privateHeaders },
    );
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("OpenAI")
      ? error.message
      : "Unable to load available OpenAI models.";
    return NextResponse.json({ error: message }, { status: 502, headers: privateHeaders });
  }
}
