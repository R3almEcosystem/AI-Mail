import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAlertGroup,
  databaseConfigured,
  listAlertGroups,
  listUsers,
} from "@/lib/admin-data";
import { requireAdminUser } from "@/lib/session";

const groupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).default(""),
  color: z.enum(["blue", "violet", "amber", "red", "green"]),
  memberIds: z.array(z.string().min(1).max(120)).max(100),
  active: z.boolean(),
});

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return null;
}

export async function GET() {
  try {
    await requireAdminUser();
    return NextResponse.json({ groups: await listAlertGroups(), demo: !databaseConfigured() });
  } catch (error) {
    return authError(error) || NextResponse.json({ error: "Unable to load escalation groups." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminUser();
    const parsed = groupSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Review the group details and try again." }, { status: 400 });

    const availableUserIds = new Set((await listUsers()).filter((user) => user.status !== "deleted").map((user) => user.id));
    const group = await createAlertGroup({
      ...parsed.data,
      memberIds: parsed.data.memberIds.filter((id) => availableUserIds.has(id)),
    }, actor);
    return NextResponse.json({ group, demo: !databaseConfigured() }, { status: 201 });
  } catch (error) {
    const known = authError(error);
    if (known) return known;
    if (error instanceof Error && error.message === "GROUP_EXISTS") return NextResponse.json({ error: "A group with that name already exists." }, { status: 409 });
    return NextResponse.json({ error: "Unable to create the escalation group." }, { status: 500 });
  }
}
