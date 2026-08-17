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

export function assertRecipientsAllowed(
  addresses: string[],
  options: { maxRecipients: number; allowedDomains: readonly string[] }
): void {
  const recipients = dedupeAddresses(addresses);
  if (recipients.length === 0) throw new Error('At least one recipient is required');
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
