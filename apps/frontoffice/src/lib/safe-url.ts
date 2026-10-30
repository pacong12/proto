/**
 * FO-09: single URL sanitiser for user-supplied links and images (feed, profiles, token pages).
 * Only http(s), ipfs:// (served through the API), same-origin API paths, inline images and blob
 * URLs are allowed; anything else (javascript:, data:text/html, vbscript:, …) becomes ''.
 */
const SAFE_PREFIXES = ['https://', 'http://', 'data:image/', 'blob:', '/api/ipfs/'];

function isSafeUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('ipfs://') || SAFE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
  );
}

export function resolveSafeUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith('ipfs://')) {
    const cid = trimmed.slice('ipfs://'.length);
    return /^[a-zA-Z0-9]+$/.test(cid) ? `/api/ipfs/${cid}` : '';
  }
  return isSafeUrl(trimmed) ? trimmed : '';
}
