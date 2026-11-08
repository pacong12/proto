/** Custom errors of the Goton curve, router and order contracts, by selector. */
const KNOWN: Record<string, string> = {
  '0xbb2875c3':
    'The price moved past your slippage tolerance before the swap went through. Try again, or raise the slippage.',
  '0xf4d678b8': 'Not enough balance for this amount.',
};

/**
 * A wallet transaction's error as a sentence for the trader: a known contract error by name,
 * otherwise viem's short message rather than the full request dump ("Request Arguments: …").
 */
export function txErrorMessage(err: unknown, fallback = 'Transaction failed'): string {
  const e = err as { shortMessage?: string; message?: string } | null;
  const text = `${e?.shortMessage ?? ''} ${e?.message ?? ''}`;
  for (const [selector, sentence] of Object.entries(KNOWN)) {
    if (text.includes(selector)) return sentence;
  }
  if (/InsufficientOutput/.test(text)) return KNOWN['0xbb2875c3']!;
  const short = (e?.shortMessage || e?.message || '').split('\n')[0]!.trim();
  return short || fallback;
}
