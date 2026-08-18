import type { ErrorRequestHandler } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { loadConfig } from './config.js';
import { MailGateway } from './mail/client.js';
import { buildMcpServer } from './mcp/server.js';
import { staticBearerAuth } from './security.js';

const config = loadConfig();
const gateway = new MailGateway(config);
const mcpHandler = createMcpHandler(() => buildMcpServer(config, gateway), { responseMode: 'json' });
const nodeHandler = toNodeHandler(mcpHandler);

const app = createMcpExpressApp({
  host: config.http.host,
  allowedHosts: config.http.allowedHosts
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({
    service: 'r3alm-ai-mail',
    status: 'ok',
    version: '0.2.0',
    runtime: process.env.VERCEL ? 'vercel' : 'node'
  });
});

app.all('/mcp', staticBearerAuth(config), (req, res) => {
  void nodeHandler(req, res, req.body);
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('Unhandled request error', error);
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal_error' });
  }
};
app.use(errorHandler);

// Vercel detects and deploys the default-exported Express application as one
// Node.js Function. Local/Docker execution retains the standalone listener.
export default app;

if (!process.env.VERCEL) {
  const server = app.listen(config.http.port, config.http.host, () => {
    console.log(`r3alm AI Mail MCP listening on ${config.http.host}:${config.http.port}`);
  });

  async function shutdown(signal: string) {
    console.log(`${signal} received; shutting down`);
    server.close();
    await mcpHandler.close();
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
