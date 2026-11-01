import { ok, err, type ApiEnvelope } from '@goton/shared-types';
import { AppError } from '../errors/app-error';

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
    code === 'INVALID_RESOLUTION' ||
    code === 'INVALID_PARAM' ||
    code === 'INVALID_TRADER'
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

/**
 * Runs a use case for a controller: its result becomes a success envelope, an AppError keeps its
 * code, and any other error is reported under `failCode`.
 */
export async function toEnvelope<T>(
  failCode: string,
  run: () => Promise<T>,
): Promise<ApiEnvelope<T>> {
  try {
    return ok(await run());
  } catch (e) {
    if (e instanceof AppError) return err(e.code, e.message);
    return err(failCode, (e as Error).message);
  }
}

/** The reply helpers of one request, all carrying its security and CORS headers. */
export function createReplies(baseHeaders: Record<string, string>) {
  return {
    replyJson: (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
      replyJson(data, status, baseHeaders, extraHeaders),
    replyError: (
      code: string,
      message: string,
      status = 400,
      extraHeaders: Record<string, string> = {},
    ) => replyError(code, message, status, baseHeaders, extraHeaders),
    replyEnvelope: (
      env: { success: boolean; error?: { code?: string } | null },
      extraHeaders: Record<string, string> = {},
    ) => replyEnvelope(env, baseHeaders, extraHeaders),
  };
}
