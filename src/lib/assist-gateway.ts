/**
 * ASSIST Email Gateway connector for server-only AI-Mail workloads.
 * No automatic SMTP fallback: switching transport requires explicit enablement.
 * Credentials and gateway URLs must be configured as server-only deployment secrets.
 */
import "server-only";

export type GatewayRequest = {
  template_key: string;
  template_version?: string;
  recipient: string;
  variables?: Record<string, string | number | boolean | null>;
  correlation_id: string;
  idempotency_key: string;
};

export type GatewayReceipt = {
  message_id: string;
  status: "queued" | "accepted";
  correlation_id: string;
};

const allowedHost = (url: URL) =>
  url.protocol === "https:" &&
  (/^[a-z]{20}\.supabase\.co$/.test(url.hostname) || url.hostname === "email.sovsi.xyz");

export async function requestAssistGatewayDelivery(
  request: GatewayRequest,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<GatewayReceipt> {
  if (process.env.ASSIST_EMAIL_GATEWAY_ENABLED !== "true") {
    throw new Error("ASSIST_GATEWAY_DISABLED");
  }
  const base = process.env.ASSIST_EMAIL_GATEWAY_URL;
  const token = process.env.ASSIST_EMAIL_GATEWAY_SERVICE_TOKEN;
  if (!base || !token || token.length < 32) throw new Error("ASSIST_GATEWAY_NOT_CONFIGURED");

  const baseUrl = new URL(base);
  if (!allowedHost(baseUrl) || baseUrl.username || baseUrl.password ||
      baseUrl.search || baseUrl.hash || baseUrl.pathname !== "/") {
    throw new Error("ASSIST_GATEWAY_INVALID_ORIGIN");
  }
  if (!request.idempotency_key || !request.correlation_id || !request.template_key ||
      !request.recipient || /[\r\n]/.test(request.recipient)) {
    throw new Error("ASSIST_GATEWAY_INVALID_REQUEST");
  }
  const url = new URL("/v1/messages", baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await (options.fetchImpl ?? fetch)(url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": request.idempotency_key,
      },
      body: JSON.stringify({ integration: "ai-mail", ...request }),
    });
    if (!res.ok) throw new Error(`ASSIST_GATEWAY_REQUEST_FAILED_${res.status}`);
    const data: unknown = await res.json();
    if (typeof data !== "object" || !data ||
        !("message_id" in data) || typeof data.message_id !== "string" ||
        !("correlation_id" in data) || data.correlation_id !== request.correlation_id ||
        !("status" in data) || !["queued", "accepted"].includes(String(data.status))) {
      throw new Error("ASSIST_GATEWAY_INVALID_RESPONSE");
    }
    return data as GatewayReceipt;
  } finally { clearTimeout(timer); }
}
