import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IpfsController } from '../src/modules/ipfs/ipfs.controller';
import { IpfsService } from '../src/modules/ipfs/ipfs.service';

function metadataRequest(body: unknown, contentType = 'application/json') {
  return new Request('http://localhost:3001/api/ipfs/metadata', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/ipfs/metadata', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PINATA_JWT;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('pins a sanitized metadata document and drops unknown fields', async () => {
    const service = new IpfsService();
    const spy = vi.spyOn(service, 'uploadFile');
    const controller = new IpfsController(service);

    const response = await controller.handleMetadataUpload(
      metadataRequest({
        name: ' Proto Cat ',
        symbol: 'PCAT',
        description: 'A cat on Solana',
        image: 'ipfs://bafybeigdyrzt',
        extensions: { website: 'https://proto.family', twitter: '', evil: 'x' },
        __proto__: { polluted: true },
        attributes: [{ trait: 'injected' }],
      }),
    );

    expect(response.success).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    const [buffer, fileName, mimeType] = spy.mock.calls[0];
    expect(fileName).toBe('pcat-metadata.json');
    expect(mimeType).toBe('application/json');
    expect(JSON.parse(Buffer.from(buffer as Buffer).toString('utf8'))).toEqual({
      name: 'Proto Cat',
      symbol: 'PCAT',
      description: 'A cat on Solana',
      image: 'ipfs://bafybeigdyrzt',
      external_url: 'https://proto.family',
      extensions: { website: 'https://proto.family' },
    });
  });

  it.each([
    [{ name: '', symbol: 'A' }, 'name must be 1-32 characters'],
    [{ name: 'Ok', symbol: 'BAD-SYMBOL' }, 'symbol must be 1-10 alphanumeric characters'],
    [
      { name: 'Ok', symbol: 'OK', image: 'javascript:alert(1)' },
      'image must be an https:// or ipfs:// URL',
    ],
    [
      { name: 'Ok', symbol: 'OK', extensions: { website: 'http://insecure.example' } },
      'extensions.website must be an https:// URL',
    ],
    [
      { name: 'Ok', symbol: 'OK', description: 'x'.repeat(1001) },
      'description must be at most 1000 characters',
    ],
  ])('rejects invalid metadata %#', async (payload, message) => {
    const response = await new IpfsController().handleMetadataUpload(metadataRequest(payload));
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error?.code).toBe('INVALID_METADATA');
      expect(response.error?.message).toBe(message);
    }
  });

  it('rejects non-JSON content, malformed JSON and oversized bodies', async () => {
    const controller = new IpfsController();
    const wrongType = await controller.handleMetadataUpload(metadataRequest('{}', 'text/plain'));
    expect(!wrongType.success && wrongType.error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const malformed = await controller.handleMetadataUpload(metadataRequest('{not json'));
    expect(!malformed.success && malformed.error?.code).toBe('INVALID_JSON');

    const huge = await controller.handleMetadataUpload(
      metadataRequest({ name: 'Ok', symbol: 'OK', description: 'x'.repeat(20_000) }),
    );
    expect(!huge.success && huge.error?.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
