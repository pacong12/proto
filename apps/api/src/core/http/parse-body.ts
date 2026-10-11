import { PayloadTooLargeError } from '../errors/app-error';

/**
 * Strict bounded JSON body parser. Enforces content-length limits before and after
 * buffering to prevent JSON bombing / Memory Exhaustion (DoS) attacks.
 */
export async function parseJsonBody<T>(req: Request, maxBytes = 65_536): Promise<T> {
  const cl = req.headers.get('content-length');
  if (cl && parseInt(cl, 10) > maxBytes) {
    throw new PayloadTooLargeError('Payload exceeds maximum allowed size');
  }
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new PayloadTooLargeError('Payload exceeds maximum allowed size');
  }
  return JSON.parse(text) as T;
}
