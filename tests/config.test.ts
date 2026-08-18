import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  MAIL_USERNAME: 'admin@r3alm.com',
  MAIL_PASSWORD: 'test-password',
  MCP_API_TOKEN: '0123456789abcdef0123456789abcdef',
  MCP_ALLOWED_HOSTS: 'localhost,127.0.0.1'
};

describe('Vercel-aware configuration', () => {
  it('always includes canonical AI-Mail deployment hostnames', () => {
    const config = loadConfig(baseEnv);

    expect(config.http.allowedHosts).toEqual(expect.arrayContaining([
      'ai-mail-r3alm.vercel.app',
      'ai-mail-git-main-r3alm.vercel.app',
      'ai-mail-mauve.vercel.app',
      'mail-ai.r3alm.com'
    ]));
  });

  it('adds Vercel deployment hostnames to the MCP allowlist', () => {
    const config = loadConfig({
      ...baseEnv,
      VERCEL: '1',
      VERCEL_URL: 'ai-mail-preview.vercel.app',
      VERCEL_BRANCH_URL: 'ai-mail-git-feature.vercel.app',
      VERCEL_PROJECT_PRODUCTION_URL: 'mail-ai.r3alm.com'
    });

    expect(config.http.allowedHosts).toEqual(expect.arrayContaining([
      'localhost',
      '127.0.0.1',
      'ai-mail-preview.vercel.app',
      'ai-mail-git-feature.vercel.app',
      'mail-ai.r3alm.com'
    ]));
  });

  it('normalizes manually configured URL-shaped hosts', () => {
    const config = loadConfig({
      ...baseEnv,
      MCP_ALLOWED_HOSTS: 'https://mail-ai.r3alm.com/'
    });

    expect(config.http.allowedHosts).toContain('mail-ai.r3alm.com');
  });
});
