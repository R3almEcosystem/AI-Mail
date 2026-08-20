import { loadConfig } from "@/gateway/config";
import { renderConsentPage } from "@/gateway/oauth/consent";

export const dynamic = "force-dynamic";

export function GET() {
  const config = loadConfig();
  return new Response(renderConsentPage(config), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": [
        "default-src 'none'",
        "script-src 'unsafe-inline' https://esm.sh",
        "connect-src https://wmqhvsiwarfpfaesctrd.supabase.co",
        "style-src 'unsafe-inline'",
        "img-src 'self' data:",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
      ].join("; "),
    },
  });
}
