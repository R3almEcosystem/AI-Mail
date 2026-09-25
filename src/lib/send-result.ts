export type SendOutcome =
  | { state: 'accepted'; demo: boolean }
  | { state: 'rejected'; message: string; findings: string[] }
  | { state: 'uncertain'; message: string };
export const unconfirmedDelivery = 'Delivery could not be confirmed. Check Sent and the mail trace before retrying; sending again could duplicate the message.';
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
/** HTTP 200 alone is not a delivery acknowledgement. Never automatically resend. */
export function parseSendResult(httpOk: boolean, payload: unknown): SendOutcome {
  const value = record(payload);
  if (!httpOk) {
    const security = record(value.security);
    const findings = value.code === 'EMAIL_SECURITY_BLOCKED' && Array.isArray(security.findings)
      ? security.findings.slice(0, 20).map(item => record(item).message).filter((message): message is string => typeof message === 'string' && message.length <= 500) : [];
    return { state: 'rejected', message: typeof value.error === 'string' && value.error.length <= 500 ? value.error : 'The mail service did not confirm acceptance. Check the mail trace before retrying.', findings };
  }
  if (value.ok === true && typeof value.demo === 'boolean' && typeof value.messageId === 'string' && value.messageId.length > 0 &&
      (value.demo || (Array.isArray(value.accepted) && value.accepted.length > 0 && value.accepted.every(address => typeof address === 'string' && address.length > 0)))) {
    return { state: 'accepted', demo: value.demo };
  }
  return { state: 'uncertain', message: unconfirmedDelivery };
}
