/**
 * Universal environment variable accessor that works across:
 *   - Node.js / Bun (process.env)
 *   - Vite / Webpack browser bundles (import.meta.env or VITE_ prefix)
 */
export function getEnv(key: string, fallback: string): string {
  // 1. Check process.env (Node.js, Bun, API server)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[key]) return process.env[key] as string;
    if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`] as string;
  }

  // 2. Check import.meta.env (Vite frontend client)
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string> })?.env;
    if (metaEnv) {
      if (metaEnv[key]) return metaEnv[key];
      if (metaEnv[`VITE_${key}`]) return metaEnv[`VITE_${key}`];
    }
  } catch {
    // Non-blocking
  }

  return fallback;
}

export function getEnvBigInt(key: string, fallback: bigint): bigint {
  const val = getEnv(key, '');
  if (!val) return fallback;
  try {
    return BigInt(val);
  } catch {
    return fallback;
  }
}
