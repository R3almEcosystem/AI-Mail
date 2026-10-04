import { authenticationConfigured, authenticationKeyMaterial, databaseConnectionString } from "@/lib/auth";
import { supabasePasswordAuthConfigured } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    service: "r3alm-ai-mail",
    status: "ok",
    version: "0.4.1",
    runtime: process.env.VERCEL ? "vercel" : "node",
    auth: {
      browser: authenticationConfigured(),
      sessionSigning: Boolean(authenticationKeyMaterial()),
      database: Boolean(databaseConnectionString()),
      supabasePassword: supabasePasswordAuthConfigured(),
    },
    routes: {
      direct: "/",
      mcp: "/mcp",
      oauth: "/oauth/consent",
    },
  });
}
