import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDeterministicCid } from '../src/modules/ipfs';
import { PublicGatewayFetcher } from '../src/modules/ipfs/infrastructure/public-gateway.fetcher';

const content = new TextEncoder().encode('gateway-content');
const cid = generateDeterministicCid(content);

/** A gateway that never answers, until its request is aborted. */
const hang = (signal: AbortSignal) =>
  new Promise<Response>((_, reject) =>
    signal.addEventListener('abort', () => reject(signal.reason)),
  );

/** Stubs fetch with one behaviour per gateway, keyed by host. */
function stubGateways(byHost: Record<string, 'hang' | 'missing' | 'wrong' | 'ok'>) {
  const aborted: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const host = new URL(url).host;
    const signal = init.signal as AbortSignal;
    signal.addEventListener('abort', () => aborted.push(host));
    switch (byHost[host]) {
      case 'hang':
        return hang(signal);
      case 'wrong':
        return new Response('notice page', { headers: { 'content-type': 'text/html' } });
      case 'ok':
        return new Response(content, { headers: { 'content-type': 'image/png' } });
      default:
        return new Response('', { status: 404 });
    }
  });
  return aborted;
}

const fetcher = (deadlineMs = 1000) =>
  new PublicGatewayFetcher(
    ['https://a.test/ipfs/', 'https://b.test/ipfs/', 'https://c.test/ipfs/'],
    deadlineMs,
  );

describe('PublicGatewayFetcher', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('serves the first gateway with the right content and aborts the others', async () => {
    const aborted = stubGateways({ 'a.test': 'hang', 'b.test': 'wrong', 'c.test': 'ok' });
    const file = await fetcher().fetch(cid);
    expect(file?.mimeType).toBe('image/png');
    expect(new Uint8Array(file!.data)).toEqual(content);
    expect(aborted).toContain('a.test');
  });

  it('gives up at the deadline when no gateway has the content', async () => {
    stubGateways({ 'a.test': 'hang', 'b.test': 'missing', 'c.test': 'wrong' });
    const started = Date.now();
    expect(await fetcher(200).fetch(cid)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
