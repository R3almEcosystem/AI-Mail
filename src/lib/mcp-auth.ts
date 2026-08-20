import { timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppConfig } from "@/gateway/config";

const keySets = new WeakMap<AppConfig, ReturnType<typeof createRemoteJWKSet>>();

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizedHost(request: Request) {
  const raw = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return end > 0 ? raw.slice(1, end) : "";
  }
  return raw.split(":")[0] || "";
}

function unauthorized(config: AppConfig) {
  return Response.json(
    { error: "invalid_token" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${config.oauth.protectedResourceMetadataUrl}"`,
      },
    },
  );
}

export async function authorizeMcpRequest(request: Request, config: AppConfig) {
  const host = normalizedHost(request);
  if (!host || !config.http.allowedHosts.includes(host)) {
    return Response.json({ error: "invalid_host" }, { status: 421 });
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return unauthorized(config);
  const token = header.slice("Bearer ".length).trim();
  if (!token) return unauthorized(config);

  if (constantTimeEquals(token, config.http.apiToken)) return null;

  try {
    let jwks = keySets.get(config);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(config.oauth.jwksUrl));
      keySets.set(config, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.oauth.issuer,
      audience: "authenticated",
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    const clientId = typeof payload.client_id === "string" ? payload.client_id : "";
    const role = typeof payload.role === "string" ? payload.role : "";
    if (
      !payload.sub
      || role !== "authenticated"
      || clientId !== config.oauth.clientId
      || !config.oauth.allowedEmails.includes(email)
    ) {
      return unauthorized(config);
    }
    return null;
  } catch {
    return unauthorized(config);
  }
}
