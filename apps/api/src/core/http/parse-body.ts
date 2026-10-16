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
  // API-04: stream the body and stop at maxBytes. Chunked requests carry no Content-Length,
  // so buffering the whole body first (req.text()) would let a client exhaust memory.
  const bytes = await readBounded(req.body, maxBytes);
  if (!bytes) throw new PayloadTooLargeError('Payload exceeds maximum allowed size');
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/**
 * Reads a byte stream into memory, aborting as soon as it exceeds `maxBytes`.
 * Returns null when the limit is exceeded; an absent stream yields an empty array.
 */
export async function readBounded(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!stream) return new Uint8Array(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
