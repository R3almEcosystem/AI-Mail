export type MailServiceConfig = {
  mail: { username: string; password: string };
  imap: { host: string; port: number; secure: boolean };
  smtp: { host: string; port: number; secure: boolean; username?: string; password?: string; from?: string };
  limits: { maxMessageBodyChars: number; maxRawMessageBytes: number; maxSearchResults: number; maxRecipients: number; outboundAllowedDomains: readonly string[] };
};
export type MailAction = 'read' | 'unread' | 'flag' | 'unflag' | 'archive';
export function checkedNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error('Invalid mail limit or port configuration');
  return number;
}
export function checkedSecure(value: string | undefined): boolean {
  if (value === undefined || value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('TLS mode must be true or false');
}
export function serviceHost(value: string | undefined): string {
  if (!value) return '';
  const host = value.trim();
  if (/^https?:\/\//i.test(host)) return new URL(host).hostname;
  if (/[\s/?#@]/u.test(host)) throw new Error('Invalid mail host');
  return host;
}
export function assertMessageIdentity(folder: string, uid?: number): void {
  if (!folder || folder.length > 255 || /[\u0000-\u001f\u007f]/u.test(folder)) throw new Error('Invalid mailbox folder');
  if (uid !== undefined && (!Number.isSafeInteger(uid) || uid < 1 || uid > 4294967295)) throw new Error('Invalid message identifier');
}
export function browserMailConfig(env: NodeJS.ProcessEnv = process.env): MailServiceConfig {
  return {
    mail: { username: env.IMAP_USER || env.MAIL_USERNAME || '', password: env.IMAP_PASSWORD || env.MAIL_PASSWORD || '' },
    imap: { host: serviceHost(env.IMAP_HOST), port: checkedNumber(env.IMAP_PORT, 993, 1, 65535), secure: checkedSecure(env.IMAP_SECURE) },
    smtp: { host: serviceHost(env.SMTP_HOST), port: checkedNumber(env.SMTP_PORT, 465, 1, 65535), secure: checkedSecure(env.SMTP_SECURE), username: env.SMTP_USER || env.MAIL_USERNAME || '', password: env.SMTP_PASSWORD || env.MAIL_PASSWORD || '', from: env.SMTP_FROM || env.MAIL_USERNAME || '' },
    limits: {
      maxMessageBodyChars: checkedNumber(env.MAX_MESSAGE_BODY_CHARS, 50000, 1000, 250000),
      maxRawMessageBytes: checkedNumber(env.MAX_RAW_MESSAGE_BYTES, 10000000, 100000, 50000000),
      maxSearchResults: checkedNumber(env.MAX_SEARCH_RESULTS, 50, 1, 100),
      maxRecipients: checkedNumber(env.MAX_RECIPIENTS, 20, 1, 100),
      outboundAllowedDomains: (env.OUTBOUND_ALLOWED_DOMAINS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean),
    },
  };
}
