import crypto from 'node:crypto';

/**
 * GRC-04: logs never carry raw client IPs. The short SHA-256 digest still lets operators correlate
 * requests from one client (same format as HttpRequestTracker) without storing the address.
 */
export function anonymizeIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}
