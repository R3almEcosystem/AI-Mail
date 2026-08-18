import type { ErrorRequestHandler } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { loadConfig } from './config.js';
import { MailGateway } from './mail/client.js';
import { buildMcpServer } from './mcp/server.js';
import { renderConsentPage } from './oauth/consent.js';
import { bearerAuth } from './security.js';

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
    version: '0.3.0',
    runtime: process.env.VERCEL ? 'vercel' : 'node',
    oauth: 'supabase-oauth-2.1'
  });
});

const protectedResourceMetadata = {
  resource: config.oauth.resource,
  authorization_servers: [config.oauth.authorizationServer],
  bearer_methods_supported: ['header'],
  scopes_supported: ['openid', 'email', 'profile', 'offline_access']
};

app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json(protectedResourceMetadata);
});

app.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json(protectedResourceMetadata);
});

app.get('/oauth/consent', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', [
    "default-src 'none'",
    "script-src 'unsafe-inline' https://esm.sh",
    "connect-src https://wmqhvsiwarfpfaesctrd.supabase.co",
    "style-src 'unsafe-inline'",
    "img-src 'self' data:",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; '));
  res.status(200).type('html').send(renderConsentPage(config));
});

app.all('/mcp', bearerAuth(config), (req, res) => {
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
