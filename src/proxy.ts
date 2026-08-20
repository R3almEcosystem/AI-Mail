import { NextRequest, NextResponse } from "next/server";
import { SESSION_NAME, verifySessionToken } from "@/lib/auth";
import { webPath } from "@/lib/web-path";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicRoute = pathname === "/" || pathname === "/login" || pathname.startsWith("/api/auth/");
  const connectorRoute = pathname === "/mcp"
    || pathname === "/healthz"
    || pathname === "/oauth/consent"
    || pathname.startsWith("/.well-known/oauth-protected-resource");
  if (publicRoute || connectorRoute) return NextResponse.next();

  const user = await verifySessionToken(request.cookies.get(SESSION_NAME)?.value);
  if (user) {
    if (pathname.startsWith("/admin") && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.redirect(new URL(webPath("/inbox"), request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const loginUrl = new URL(webPath("/login"), request.url);
  loginUrl.searchParams.set("next", webPath(pathname));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
