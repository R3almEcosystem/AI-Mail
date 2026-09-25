import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await getSessionUser();
    return user ? NextResponse.json({ user }, { headers: privateHeaders }) : NextResponse.json({ error: "Authentication required." }, { status: 401 });
  } catch (error) { return apiError(error); }
}
