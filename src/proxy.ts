import { NextRequest, NextResponse } from "next/server";
import { SESSION_NAME, verifySessionToken } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/auth-policy";
import { webPath } from "@/lib/web-path";
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const connectorRoute = pathname === "/mcp" || pathname === "/healthz" || pathname === "/oauth/consent" || pathname.startsWith("/.well-known/oauth-protected-resource");
  if (connectorRoute) return NextResponse.next(); // MCP has its own bearer authorization boundary.
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/api/auth/")) return NextResponse.next();
  // Optimistic routing only. Protected handlers and pages re-check current database state.
  const user = await verifySessionToken(request.cookies.get(SESSION_NAME)?.value);
  if (user) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const loginUrl = new URL(webPath("/login"), request.url);
  loginUrl.searchParams.set("next", webPath(pathname));
  return NextResponse.redirect(loginUrl);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
