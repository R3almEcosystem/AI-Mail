import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseConfigured, listUsers, updateUser } from "@/lib/admin-data";
import { requireAdminUser } from "@/lib/session";

const roles = ["super_admin", "admin", "manager", "member", "viewer"] as const;
const statuses = ["active", "invited", "suspended", "deleted"] as const;
const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(320).optional(),
  title: z.string().trim().max(120).optional(),
  role: z.enum(roles).optional(),
  status: z.enum(statuses).optional(),
  password: z.string().min(10).max(500).optional().or(z.literal("")),
});

async function authorizeTarget(actorId: string, actorRole: string, targetId: string, role?: string, status?: string) {
  const target = (await listUsers()).find((user) => user.id === targetId);
  if (!target) return { error: "User not found.", status: 404 };
  if (actorId === targetId && (role && role !== target.role || status && status !== target.status)) {
    return { error: "You cannot change your own role or access status.", status: 400 };
  }
  if (actorRole !== "super_admin" && (target.role === "admin" || target.role === "super_admin" || role === "admin" || role === "super_admin")) {
    return { error: "Only a Super Admin can manage administrator accounts.", status: 403 };
  }
  return { target };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminUser();
    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Review the user details and try again." }, { status: 400 });
    const authorization = await authorizeTarget(actor.id, actor.role, id, parsed.data.role, parsed.data.status);
    if ("error" in authorization) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const user = await updateUser(id, { ...parsed.data, password: parsed.data.password || undefined }, actor);
    return NextResponse.json({ user, demo: !databaseConfigured() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to update the user." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminUser();
    const { id } = await params;
    const authorization = await authorizeTarget(actor.id, actor.role, id, undefined, "deleted");
    if ("error" in authorization) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const user = await updateUser(id, { status: "deleted" }, actor);
    return NextResponse.json({ user, demo: !databaseConfigured() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to remove the user." }, { status: 500 });
  }
}
