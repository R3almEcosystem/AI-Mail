import { z } from 'zod';

const booleanString = z
  .string()
  .default('true')
  .transform((value) => value.toLowerCase() === 'true');

const BUILTIN_ALLOWED_HOSTS = [
  'ai-mail-r3alm.vercel.app',
  'ai-mail-git-main-r3alm.vercel.app',
  'ai-mail-mauve.vercel.app',
  'mail-ai.r3alm.com'
] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MAIL_USERNAME: z.string().email(),
  MAIL_PASSWORD: z.string().min(1, 'MAIL_PASSWORD is required'),
  IMAP_HOST: z.string().min(1).default('mail.r3alm.com'),
  IMAP_PORT: z.coerce.number().int().positive().default(993),
  IMAP_SECURE: booleanString,
  SMTP_HOST: z.string().min(1).default('mail.r3alm.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: booleanString,
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  MCP_ALLOWED_HOSTS: z.string().default('localhost,127.0.0.1'),
  MCP_API_TOKEN: z.string().min(32, 'MCP_API_TOKEN must be at least 32 characters'),
  MAX_MESSAGE_BODY_CHARS: z.coerce.number().int().min(1000).max(250000).default(50000),
  MAX_RAW_MESSAGE_BYTES: z.coerce.number().int().min(100000).max(50000000).default(10000000),
  MAX_SEARCH_RESULTS: z.coerce.number().int().min(1).max(100).default(50),
  MAX_RECIPIENTS: z.coerce.number().int().min(1).max(100).default(20),
  OUTBOUND_ALLOWED_DOMAINS: z.string().default('')
});

export type AppConfig = ReturnType<typeof loadConfig>;

function normalizeAllowedHost(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;

  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  const withoutPath = raw.split('/')[0] ?? '';
  if (withoutPath.startsWith('[')) {
    const end = withoutPath.indexOf(']');
    return end > 0 ? withoutPath.slice(1, end).toLowerCase() : undefined;
  }
  return (withoutPath.split(':')[0] || undefined)?.toLowerCase();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${message}`);
  }

  const data = parsed.data;
  const configuredHosts = data.MCP_ALLOWED_HOSTS.split(',');
  const vercelHosts = [
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL
  ];
  const allowedHosts = [...new Set(
    [...BUILTIN_ALLOWED_HOSTS, ...configuredHosts, ...vercelHosts]
      .map(normalizeAllowedHost)
      .filter((value): value is string => Boolean(value))
  )];

  const outboundAllowedDomains = data.OUTBOUND_ALLOWED_DOMAINS.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (data.HOST === '0.0.0.0' && allowedHosts.length === 0) {
    throw new Error('MCP_ALLOWED_HOSTS must be set when binding to 0.0.0.0');
  }

  return {
    nodeEnv: data.NODE_ENV,
    mail: {
      username: data.MAIL_USERNAME,
      password: data.MAIL_PASSWORD
    },
    imap: {
      host: data.IMAP_HOST,
      port: data.IMAP_PORT,
      secure: data.IMAP_SECURE
    },
    smtp: {
      host: data.SMTP_HOST,
      port: data.SMTP_PORT,
      secure: data.SMTP_SECURE
    },
    http: {
      host: data.HOST,
      port: data.PORT,
      allowedHosts,
      apiToken: data.MCP_API_TOKEN
    },
    limits: {
      maxMessageBodyChars: data.MAX_MESSAGE_BODY_CHARS,
      maxRawMessageBytes: data.MAX_RAW_MESSAGE_BYTES,
      maxSearchResults: data.MAX_SEARCH_RESULTS,
      maxRecipients: data.MAX_RECIPIENTS,
      outboundAllowedDomains
    }
  } as const;
}
