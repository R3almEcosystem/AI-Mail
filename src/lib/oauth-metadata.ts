import { loadConfig } from "@/gateway/config";

export function protectedResourceMetadataResponse() {
  const config = loadConfig();
  return Response.json(
    {
      resource: config.oauth.resource,
      authorization_servers: [config.oauth.authorizationServer],
      bearer_methods_supported: ["header"],
      scopes_supported: ["openid", "email", "profile", "offline_access"],
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
