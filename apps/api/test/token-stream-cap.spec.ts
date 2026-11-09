import { describe, expect, it } from 'vitest';
import { server } from '../src/server';
import { MAX_STREAMS_PER_IP } from '../src/modules/tokens/presentation/tokens.routes';

const TOKEN = '0x00000000000000000000000000000000000000aa';

describe('token streams', () => {
  it('caps open streams per client and frees a slot when one closes', async () => {
    const open = async () => {
      const ctrl = new AbortController();
      const res = await server.fetch(
        new Request(`http://localhost:3001/api/tokens/${TOKEN}/stream`, { signal: ctrl.signal }),
      );
      return { res, close: () => ctrl.abort() };
    };
    const streams = [];
    for (let i = 0; i < MAX_STREAMS_PER_IP; i++) streams.push(await open());
    expect(streams.every((s) => s.res.status === 200)).toBe(true);

    const refused = await open();
    expect(refused.res.status).toBe(429);

    streams[0].close();
    const again = await open();
    expect(again.res.status).toBe(200);

    for (const s of [...streams, again]) {
      s.close();
      await s.res.body?.cancel().catch(() => undefined);
    }
  });
});
