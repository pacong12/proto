/** Which uploads are accepted: images of an allowed type, within the size limit, whose bytes match. */

// MIME type whitelist: only image formats accepted.
// Executable, HTML, and other dangerous types are rejected before any bytes are processed.
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

/** 5 MiB hard limit, checked before any bytes are stored or pinned. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface UploadRejection {
  code: string;
  message: string;
}

export function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export function unsupportedType(mimeType: string): UploadRejection {
  return {
    code: 'UNSUPPORTED_MIME_TYPE',
    message: `Only image uploads are accepted. Received: ${mimeType}`,
  };
}

export const TOO_LARGE: UploadRejection = {
  code: 'FILE_TOO_LARGE',
  message: 'Upload exceeds 5 MiB limit',
};

/**
 * Scan SVG byte stream for executable scripts, inline event handlers, or dangerous foreignObjects.
 * Prevents SVG-based Stored Cross-Site Scripting (XSS).
 * Uses linear non-backtracking patterns to prevent polynomial ReDoS.
 */
function isMaliciousSvg(buf: Buffer): boolean {
  const raw = buf.toString('utf8').toLowerCase();
  // Tags and attribute names cannot be written as character references, so markup checks run on
  // the raw text (an escaped `&lt;script` in text content stays text). URL schemes inside
  // attribute values can be encoded (`javascript&#58;`, `java&#x09;script:`), so those checks
  // run on the decoded value with whitespace and control characters removed.
  // eslint-disable-next-line no-control-regex
  const urls = decodeEntities(raw).replace(/[\u0000- ]+/g, '');
  return (
    raw.includes('<script') ||
    raw.includes('<foreignobject') ||
    raw.includes('<!entity') ||
    /\bon[a-z]+\s*=/i.test(raw) ||
    urls.includes('javascript:') ||
    urls.includes('vbscript:') ||
    urls.includes('data:text/html')
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
};

function safeCodePoint(cp: number): string {
  return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
}

/** Decodes numeric (`&#58;`, `&#x3a;`) and the few named character references attackers use. */
function decodeEntities(text: string): string {
  let out = text;
  // Repeat so double encodings (`&amp;#58;`) collapse too; bounded to stay linear.
  for (let i = 0; i < 3; i++) {
    const next = out
      .replace(/&#x([0-9a-f]{1,6});?/gi, (_, h: string) => safeCodePoint(parseInt(h, 16)))
      .replace(/&#(\d{1,7});?/g, (_, d: string) => safeCodePoint(parseInt(d, 10)))
      .replace(/&([a-z]{2,7});/gi, (m, n: string) => NAMED_ENTITIES[n.toLowerCase()] ?? m);
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * True when the bytes really are the declared image type. The declared type is only the
 * client's word, so without this any file could be pinned to our IPFS account as "image/png".
 */
function contentMatchesType(mimeType: string, b: Buffer): boolean {
  const ascii = (start: number, end: number) => b.subarray(start, end).toString('latin1');
  switch (mimeType) {
    case 'image/png':
      return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/gif':
      return ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a';
    case 'image/webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    case 'image/svg+xml':
      return b.subarray(0, 1024).toString('utf8').toLowerCase().includes('<svg');
    default:
      return false;
  }
}

/** Why an upload is refused, or null when it is an acceptable image. */
export function checkImageUpload(data: Buffer, mimeType: string): UploadRejection | null {
  if (!isAllowedImageType(mimeType)) return unsupportedType(mimeType);
  if (data.byteLength > MAX_UPLOAD_BYTES) return TOO_LARGE;
  if (mimeType === 'image/svg+xml' && isMaliciousSvg(data)) {
    return {
      code: 'MALICIOUS_PAYLOAD',
      message: 'SVG contains disallowed executable scripts or event handlers',
    };
  }
  if (!contentMatchesType(mimeType, data)) {
    return { code: 'CONTENT_TYPE_MISMATCH', message: `File content is not a valid ${mimeType}` };
  }
  return null;
}
