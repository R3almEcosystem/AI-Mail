import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { AppConfig } from './config.js';

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function staticBearerAuth(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    const authHeader = req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token || !constantTimeEquals(token, config.http.apiToken)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    next();
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
