import { NextResponse } from "next/server";
import { z } from "zod";
import {
  databaseConfigured,
  listUsers,
  retireAlertGroup,
  updateAlertGroup,
} from "@/lib/admin-data";
import { requireAdminUser } from "@/lib/session";

const groupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).default(""),
  color: z.enum(["blue", "violet", "amber", "red", "green"]),
  memberIds: z.array(z.string().min(1).max(120)).max(100),
  active: z.boolean(),
});

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  if (message === "NOT_FOUND") return NextResponse.json({ error: "Escalation group not found." }, { status: 404 });
  if (message === "GROUP_EXISTS") return NextResponse.json({ error: "A group with that name already exists." }, { status: 409 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminUser();
    const { id } = await params;
    const parsed = groupSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Review the group details and try again." }, { status: 400 });

    const availableUserIds = new Set((await listUsers()).filter((user) => user.status !== "deleted").map((user) => user.id));
    const group = await updateAlertGroup(id, {
      ...parsed.data,
      memberIds: parsed.data.memberIds.filter((memberId) => availableUserIds.has(memberId)),
    }, actor);
    return NextResponse.json({ group, demo: !databaseConfigured() });
  } catch (error) {
    return errorResponse(error, "Unable to update the escalation group.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminUser();
    const { id } = await params;
    const group = await retireAlertGroup(id, actor);
    return NextResponse.json({ group, demo: !databaseConfigured() });
  } catch (error) {
    return errorResponse(error, "Unable to retire the escalation group.");
  }
}
