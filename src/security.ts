import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppConfig } from './config.js';

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function challenge(config: AppConfig): string {
  return `Bearer resource_metadata="${config.oauth.protectedResourceMetadataUrl}"`;
}

function unauthorized(config: AppConfig, res: Parameters<RequestHandler>[1]) {
  res.setHeader('WWW-Authenticate', challenge(config));
  res.status(401).json({ error: 'invalid_token' });
}

export function bearerAuth(config: AppConfig): RequestHandler {
  const jwks = createRemoteJWKSet(new URL(config.oauth.jwksUrl));

  return async (req, res, next) => {
    const authHeader = req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      unauthorized(config, res);
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      unauthorized(config, res);
      return;
    }

    // Preserve the original long-lived administrative bearer credential for
    // controlled API/CI use while allowing ChatGPT to use short-lived OAuth tokens.
    if (constantTimeEquals(token, config.http.apiToken)) {
      next();
      return;
    }

    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: config.oauth.issuer,
        audience: 'authenticated'
      });

      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
      const clientId = typeof payload.client_id === 'string' ? payload.client_id : '';
      const role = typeof payload.role === 'string' ? payload.role : '';

      if (
        !payload.sub ||
        role !== 'authenticated' ||
        clientId !== config.oauth.clientId ||
        !config.oauth.allowedEmails.includes(email)
      ) {
        unauthorized(config, res);
        return;
      }

      res.locals.oauth = {
        subject: payload.sub,
        email,
        clientId
      };
      next();
    } catch {
      unauthorized(config, res);
    }
  };
}

export function redactError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
      .replace(/(password|pass|token|authorization)=?[^\s,;]*/gi, '$1=[REDACTED]')
      .slice(0, 1000);
  }
  return 'Unknown error';
}
