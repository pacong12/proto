/**
 * Safe JSON stringify helper converting BigInt values to string representation.
 */
export function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
}

/**
 * Derives HTTP status code from an ApiEnvelope.
 */
export function deriveEnvelopeStatus(env: {
  success: boolean;
  error?: { code?: string } | null;
}): number {
  if (env.success) return 200;
  const code = env.error?.code ?? '';
  if (code === 'TOKEN_NOT_FOUND' || code === 'INVALID_ADDRESS' || code === 'NOT_FOUND') return 404;
  if (
    code === 'INVALID_INPUT' ||
    code === 'INVALID_INTENT' ||
    code === 'VALIDATION_ERROR' ||
    code === 'INVALID_COMMENT' ||
    code === 'INVALID_AUTHOR' ||
    code === 'INVALID_RESOLUTION'
  )
    return 400;
  if (code === 'PAYLOAD_TOO_LARGE') return 413;
  if (code === 'RATE_LIMIT_EXCEEDED') return 429;
  if (code === 'UNAUTHORIZED') return 401;
  return 500;
}

/**
 * Creates standard successful or failure JSON response.
 */
export function replyJson(
  data: unknown,
  status = 200,
  baseHeaders: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(safeStringify(data), {
    status,
    headers: { ...baseHeaders, ...extraHeaders },
  });
}

/**
 * Creates standard error JSON response.
 */
export function replyError(
  code: string,
  message: string,
  status = 400,
  baseHeaders: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    safeStringify({
      success: false,
      data: null,
      error: { code, message },
      timestamp: Date.now(),
    }),
    {
      status,
      headers: { ...baseHeaders, ...extraHeaders },
    },
  );
}

/**
 * Wraps an ApiEnvelope in a Web Standard Response with derived HTTP status.
 */
export function replyEnvelope(
  env: { success: boolean; error?: { code?: string } | null },
  baseHeaders: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(safeStringify(env), {
    status: deriveEnvelopeStatus(env),
    headers: { ...baseHeaders, ...extraHeaders },
  });
}
