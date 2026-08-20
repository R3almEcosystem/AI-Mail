export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    service: "r3alm-ai-mail",
    status: "ok",
    version: "0.4.0",
    runtime: process.env.VERCEL ? "vercel" : "node",
    routes: {
      direct: "/",
      mcp: "/mcp",
      oauth: "/oauth/consent",
    },
  });
}
