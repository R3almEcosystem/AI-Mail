import { createMcpHandler } from "@modelcontextprotocol/server";
import type { AppConfig } from "@/config";
import { loadConfig } from "@/config";
import { MailGateway } from "@/mail/client";
import { buildMcpServer } from "@/mcp/server";
import { authorizeMcpRequest } from "@/lib/mcp-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

type State = {
  config: AppConfig;
  handler: ReturnType<typeof createMcpHandler>;
};

let state: State | undefined;

function getState(): State {
  if (state) return state;
  const config = loadConfig();
  const gateway = new MailGateway(config);
  state = {
    config,
    handler: createMcpHandler(
      () => buildMcpServer(config, gateway),
      { responseMode: "json" },
    ),
  };
  return state;
}

async function serve(request: Request) {
  const current = getState();
  const rejection = await authorizeMcpRequest(request, current.config);
  if (rejection) return rejection;
  return current.handler.fetch(request);
}

export { serve as GET, serve as POST, serve as DELETE };
