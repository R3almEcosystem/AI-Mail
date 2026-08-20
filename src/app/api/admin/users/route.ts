import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, databaseConfigured, listUsers } from "@/lib/admin-data";
import { requireAdminUser } from "@/lib/session";

const roles = ["super_admin", "admin", "manager", "member", "viewer"] as const;
const statuses = ["active", "invited", "suspended"] as const;
const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(320),
  title: z.string().trim().max(120).default(""),
  role: z.enum(roles),
  status: z.enum(statuses),
  password: z.string().min(10).max(500).optional().or(z.literal("")),
});

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return null;
}

export async function GET() {
  try {
    await requireAdminUser();
    return NextResponse.json({ users: await listUsers(), demo: !databaseConfigured() });
  } catch (error) {
    return authError(error) || NextResponse.json({ error: "Unable to load users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminUser();
    const parsed = userSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Review the user details and try again." }, { status: 400 });
    if (actor.role !== "super_admin" && (parsed.data.role === "admin" || parsed.data.role === "super_admin")) {
      return NextResponse.json({ error: "Only a Super Admin can assign administrator roles." }, { status: 403 });
    }
    const user = await createUser({ ...parsed.data, password: parsed.data.password || undefined }, actor);
    return NextResponse.json({ user, demo: !databaseConfigured() }, { status: 201 });
  } catch (error) {
    const known = authError(error);
    if (known) return known;
    if (error instanceof Error && error.message === "EMAIL_EXISTS") return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
    return NextResponse.json({ error: "Unable to create the user." }, { status: 500 });
  }
}
