import { NextRequest, NextResponse } from "next/server";
import { SESSION_NAME, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicRoute = pathname === "/" || pathname === "/login" || pathname.startsWith("/api/auth/");
  if (publicRoute) return NextResponse.next();

  const user = await verifySessionToken(request.cookies.get(SESSION_NAME)?.value);
  if (user) {
    if (pathname.startsWith("/admin") && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
