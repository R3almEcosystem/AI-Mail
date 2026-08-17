export type SimpleAddress = {
  name?: string;
  address: string;
};

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function dedupeAddresses(addresses: string[]): string[] {
  return [...new Set(addresses.map(normalizeAddress).filter(Boolean))];
}

export function isSafeEmailAddress(address: string): boolean {
  if (!address || address.length > 320 || /[\r\n\s<>(),;:"]/u.test(address)) return false;

  const parts = address.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain || local.length > 64 || domain.length > 255) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/u.test(local)) return false;

  const labels = domain.split('.');
  return labels.every(
    (label) =>
      Boolean(label) &&
      label.length <= 63 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u.test(label)
  );
}

export function assertRecipientsAllowed(
  addresses: string[],
  options: { maxRecipients: number; allowedDomains: readonly string[] }
): void {
  const recipients = dedupeAddresses(addresses);
  if (recipients.length === 0) throw new Error('At least one recipient is required');

  const invalid = recipients.filter((address) => !isSafeEmailAddress(address));
  if (invalid.length > 0) {
    throw new Error(`Invalid recipient address: ${invalid.join(', ')}`);
  }

  if (recipients.length > options.maxRecipients) {
    throw new Error(`Recipient count exceeds limit of ${options.maxRecipients}`);
  }

  if (options.allowedDomains.length === 0) return;
  const blocked = recipients.filter((address) => {
    const domain = address.split('@')[1]?.toLowerCase();
    return !domain || !options.allowedDomains.includes(domain);
  });

  if (blocked.length > 0) {
    throw new Error(`Recipient domain is not allowed: ${blocked.join(', ')}`);
  }
}

export function envelopeAddresses(input: unknown): SimpleAddress[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item): SimpleAddress[] => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.address === 'string') {
      return [{
        address: candidate.address,
        ...(typeof candidate.name === 'string' && candidate.name ? { name: candidate.name } : {})
      }];
    }
    if (Array.isArray(candidate.group)) return envelopeAddresses(candidate.group);
    return [];
  });
}
