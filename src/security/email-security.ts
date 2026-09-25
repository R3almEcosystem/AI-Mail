/**
 * r3alm local email rules, v1. Keep this file identical in email-gateway and AI-Mail.
 * No network, executable content, authentication-header trust, or malware-clear verdicts.
 * Indicators are deliberately redacted; a no-match result is NOT a safety guarantee.
 */
export type SecurityMessage = {
  direction: 'inbound' | 'outbound'; subject: string; text: string; html?: string;
  from?: string; replyTo?: string;
  attachments?: ReadonlyArray<{ filename?: string; mimeType?: string }>;
};
export type FindingCode =
  | 'invalid_input' | 'inspection_limit' | 'private_key' | 'payment_card'
  | 'social_security_number' | 'active_url' | 'url_credentials' | 'insecure_url'
  | 'ip_url' | 'international_domain' | 'link_mismatch' | 'reply_to_mismatch'
  | 'payment_request' | 'credential_request' | 'untrusted_ai_instruction'
  | 'dangerous_attachment' | 'macro_attachment' | 'archive_attachment'
  | 'attachment_unscanned' | 'obscured_filename';
export type SecurityFinding = { code: FindingCode; severity: 'block' | 'review'; message: string };
export type SecurityAssessment = {
  engine: 'r3alm-email-rules/1'; disposition: 'block' | 'review' | 'no_local_match';
  findings: SecurityFinding[];
  coverage: { authentication: 'not_verified'; malware: 'not_scanned'; urlReputation: 'not_checked'; attachmentContent: 'not_scanned' };
};
const descriptions: Record<FindingCode, string> = {
  invalid_input: 'The message cannot be inspected because its input is invalid.',
  inspection_limit: 'The message exceeds a local inspection limit; complete inspection is unavailable.',
  private_key: 'Potential private-key material detected. Remove it and use an approved secret-sharing channel.',
  payment_card: 'A likely payment-card number was detected. Use an approved payment-data channel.',
  social_security_number: 'A labelled, structurally valid Social Security number was detected.',
  active_url: 'An active or local-resource link was detected.',
  url_credentials: 'A link contains embedded credentials or a misleading user-information section.',
  insecure_url: 'A link uses unencrypted HTTP. Verify its destination independently.',
  ip_url: 'A link uses an IP address rather than a named website.',
  international_domain: 'A link uses an internationalized domain. Check its spelling carefully.',
  link_mismatch: 'A displayed web address and its link destination use different hosts.',
  reply_to_mismatch: 'The reply-to address uses a different domain from the sender.',
  payment_request: 'Urgency and a payment-related request appear together. Verify payment instructions independently.',
  credential_request: 'The message appears to request a password or authentication code.',
  untrusted_ai_instruction: 'The message contains instructions aimed at an AI assistant; treat them as untrusted email content.',
  dangerous_attachment: 'An attachment has a potentially executable filename or MIME type.',
  macro_attachment: 'An attachment has a macro-enabled Office filename or MIME type.',
  archive_attachment: 'An archive attachment requires content inspection; its contents have not been inspected.',
  attachment_unscanned: 'Attachment content has not been malware-scanned by this rules engine.',
  obscured_filename: 'An attachment filename contains direction-changing or invisible characters.',
};
const coverage: SecurityAssessment['coverage'] = {
  authentication: 'not_verified', malware: 'not_scanned', urlReputation: 'not_checked', attachmentContent: 'not_scanned',
};
const MAX_CHARS = 2_100_000;
const invisible = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]{1,6}|#\d{1,7}|amp|quot|apos|lt|gt|colon|tab|newline|nbsp);?/gi, (original, entity: string) => {
    if (entity[0] === '#') {
      const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : original;
    }
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', colon: ':', tab: '\t', newline: '\n', nbsp: ' ' } as Record<string, string>)[entity.toLowerCase()] ?? original;
  });
}
/** Linear indicator-only text view. Preserve unterminated markup instead of backtracking. */
function stripTagsForIndicators(value: string): string {
  const parts: string[] = []; let textStart = 0; let tagStart = -1;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '<' && tagStart < 0) {
      if (index > textStart) parts.push(value.slice(textStart, index));
      tagStart = index;
    } else if (value[index] === '>' && tagStart >= 0) {
      textStart = index + 1; tagStart = -1;
    }
  }
  parts.push(value.slice(tagStart >= 0 ? tagStart : textStart));
  return parts.join('');
}
function likelyCard(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (!/^(?:4\d{12}(?:\d{3})?(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011\d{12}|5\d{14}|4[4-9]\d{13})|(?:222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)\d{12})$/.test(digits)) return false;
  let sum = 0; let twice = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]); if (twice) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit; twice = !twice;
  }
  return sum % 10 === 0;
}
function mailboxDomain(address?: string): string | undefined {
  const match = address?.trim().match(/(?:^|<)[^<>\s@]+@([a-z\d.-]+)>?$/i);
  return match?.[1].toLowerCase().replace(/\.$/, '');
}
function webUrl(value: string): URL | null {
  try {
    const normalized = value.replace(/[\u0000-\u0020\u007f]/g, '');
    const parsed = new URL(normalized.startsWith('//') ? `https:${normalized}` : normalized);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null;
  } catch { return null; }
}
export function assessEmailSecurity(input: SecurityMessage): SecurityAssessment {
  const findings = new Map<FindingCode, SecurityFinding>();
  const add = (code: FindingCode, severity: 'block' | 'review' = 'review') => {
    if (!findings.has(code) || severity === 'block') findings.set(code, { code, severity, message: descriptions[code] });
  };
  const result = (): SecurityAssessment => ({
    engine: 'r3alm-email-rules/1',
    disposition: [...findings.values()].some(finding => finding.severity === 'block') ? 'block' : findings.size ? 'review' : 'no_local_match',
    findings: [...findings.values()], coverage: { ...coverage },
  });
  if (!input || typeof input !== 'object' || !['inbound', 'outbound'].includes(input.direction) ||
      typeof input.subject !== 'string' || typeof input.text !== 'string' ||
      ['html', 'from', 'replyTo'].some(key => {
        const value = (input as unknown as Record<string, unknown>)[key]; return value !== undefined && typeof value !== 'string';
      }) || (input.attachments !== undefined && !Array.isArray(input.attachments))) {
    add('invalid_input', 'block'); return result();
  }
  if (input.subject.length + input.text.length + (input.html?.length ?? 0) > MAX_CHARS ||
      (input.from?.length ?? 0) > 512 || (input.replyTo?.length ?? 0) > 512 || (input.attachments?.length ?? 0) > 100) {
    add('inspection_limit', 'block'); return result();
  }
  const attachments = input.attachments ?? [];
  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object' || ['filename', 'mimeType'].some(key => {
      const value = (attachment as Record<string, unknown>)[key]; return value !== undefined && typeof value !== 'string';
    })) { add('invalid_input', 'block'); return result(); }
    if ((attachment.filename?.length ?? 0) > 512 || (attachment.mimeType?.length ?? 0) > 256) { add('inspection_limit', 'block'); return result(); }
  }
  // These normalized text views are for local indicators, never for rendering HTML.
  const html = decodeEntities(input.html ?? '');
  const flattened = stripTagsForIndicators(html);
  const content = `${input.subject}\n${input.text}\n${html}\n${flattened}`.normalize('NFKC').replace(invisible, '');
  const dlpSeverity = input.direction === 'outbound' ? 'block' : 'review';
  if (/-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(content)) add('private_key', dlpSeverity);
  for (const match of content.matchAll(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g)) {
    if (likelyCard(match[0])) { add('payment_card', dlpSeverity); break; }
  }
  for (const match of content.matchAll(/\b(?:SSN|social\s+security(?:\s+(?:number|no\.?))?)\s*[:=#-]?\s*(\d{3})[- ]?(\d{2})[- ]?(\d{4})\b/gi)) {
    const area = Number(match[1]);
    if (area > 0 && area < 900 && area !== 666 && Number(match[2]) > 0 && Number(match[3]) > 0) add('social_security_number', dlpSeverity);
  }
  const urls = new Set<string>(); let candidates = 0;
  const inspectUrl = (raw: string) => {
    if (++candidates > 1000 || raw.length > 4096) { add('inspection_limit', 'block'); return; }
    if (urls.has(raw)) return;
    if (urls.size >= 200) { add('inspection_limit', 'block'); return; }
    urls.add(raw);
    const compact = decodeEntities(raw).replace(/[\u0000-\u0020\u007f]/g, '');
    if (/^(?:javascript|data|vbscript|file|blob):/i.test(compact)) { add('active_url', 'block'); return; }
    const url = webUrl(compact); if (!url) return;
    if (url.username || url.password) add('url_credentials', 'block');
    if (url.protocol === 'http:') add('insecure_url');
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.startsWith('[')) add('ip_url');
    if (url.hostname.split('.').some(part => part.startsWith('xn--'))) add('international_domain');
  };
  for (const match of html.matchAll(/\b(?:href|src|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    inspectUrl(match[1] ?? match[2] ?? match[3]); if (candidates > 1000) break;
  }
  for (const match of `${input.text}\n${html}`.matchAll(/\b(?:https?:\/\/|javascript:|data:|vbscript:|file:|blob:)[^\s<>"']+/gi)) {
    inspectUrl(match[0]); if (candidates > 1000) break;
  }
  // Exclude nested '<' while tokenizing: malformed markup cannot create overlapping scans.
  for (const match of html.matchAll(/<a\b[^<>]*>/gi)) {
    if (match[0].length > 8192) { add('inspection_limit', 'block'); continue; }
    const attribute = match[0].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!attribute) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end = html.indexOf('<', start);
    if (end < 0 || end - start > 2048 || !/^<\/a\s*>/i.test(html.slice(end, end + 32))) continue;
    const target = webUrl(attribute[1] ?? attribute[2] ?? attribute[3]);
    const visible = webUrl(html.slice(start, end).trim());
    if (target && visible && target.hostname.toLowerCase() !== visible.hostname.toLowerCase()) add('link_mismatch');
  }
  const sender = mailboxDomain(input.from); const reply = mailboxDomain(input.replyTo);
  if (sender && reply && sender !== reply) add('reply_to_mismatch');
  if (/\b(?:urgent|immediately|today|asap|confidential)\b/i.test(content) && /\b(?:wire transfer|bank account|gift cards?|payment details|bank details)\b/i.test(content)) add('payment_request');
  if (/\b(?:send|share|provide|confirm)\s+(?:me\s+)?(?:your\s+)?(?:password|one.time (?:code|password)|authentication code|verification code)\b/i.test(content)) add('credential_request');
  if (/ignore\s+(?:all\s+)?(?:previous|prior|system)\s+instructions|reveal\s+(?:the\s+)?system\s+prompt/i.test(content)) add('untrusted_ai_instruction');
  if (attachments.length) add('attachment_unscanned');
  for (const attachment of attachments) {
    const original = attachment.filename ?? '';
    if (/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/.test(original)) add('obscured_filename');
    const name = original.normalize('NFKC').replace(invisible, '').trim().replace(/[. ]+$/, '').toLowerCase();
    const mime = (attachment.mimeType ?? '').toLowerCase().split(';')[0].trim();
    if (/\.(?:exe|com|scr|pif|bat|cmd|ps1|vbs|vbe|js|jse|wsf|wsh|msi|msp|hta|lnk|jar|reg|dll|sh|app|apk|iso|img)$/.test(name) || /^(?:application\/(?:x-msdownload|x-msdos-program|x-executable|x-sh|x-bat|x-dosexec)|(?:application|text)\/(?:javascript|x-javascript))$/.test(mime)) add('dangerous_attachment', 'block');
    if (/\.(?:docm|dotm|xlsm|xltm|xlam|xlsb|pptm|potm|ppam|ppsm|sldm)$/.test(name) || mime.includes('macroenabled')) add('macro_attachment', 'block');
    if (/\.(?:zip|rar|7z|tar|gz|bz2|xz)$/.test(name) || /(?:zip|rar|7z|tar|gzip)/.test(mime)) add('archive_attachment');
  }
  return result();
}
export class EmailSecurityPolicyError extends Error {
  readonly code = 'EMAIL_SECURITY_BLOCKED';
  readonly assessment: SecurityAssessment;
  constructor(assessment: SecurityAssessment) {
    super('Email blocked by the local security policy. Review the security findings before retrying.');
    this.name = 'EmailSecurityPolicyError'; this.assessment = assessment;
  }
}
/** Direction is fixed here, not trusted from a caller or a message header. */
export function assertOutboundEmailSecurity(input: SecurityMessage): SecurityAssessment {
  const assessment = assessEmailSecurity({ ...input, direction: 'outbound' });
  if (assessment.disposition === 'block') throw new EmailSecurityPolicyError(assessment);
  return assessment;
}
