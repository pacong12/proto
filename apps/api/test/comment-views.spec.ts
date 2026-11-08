import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { buildCommentSignMessage } from '@goton/shared-types';
import { server } from '../src/server';

const signer = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
);
const TOKEN = '0x00000000000000000000000000000000000c0ffe';
const API = 'http://localhost:3001';

async function signedComment(content: string) {
  const timestamp = Date.now();
  const signature = await signer.signMessage({
    message: buildCommentSignMessage({
      tokenAddress: TOKEN,
      authorAddress: signer.address,
      content,
      timestamp,
    }),
  });
  return { authorAddress: signer.address, content, callType: 'comment', signature, timestamp };
}

const post = (body: unknown) =>
  server.fetch(
    new Request(`${API}/api/tokens/${TOKEN}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const view = (id: string) =>
  server.fetch(new Request(`${API}/api/comments/${id}/view`, { method: 'POST' }));

describe('Comment views', () => {
  it('counts one view per client and callout, and 404s an unknown callout', async () => {
    const created = await (await post(await signedComment('view me'))).json();
    const id = created.data.id as string;

    const first = await (await view(id)).json();
    const second = await (await view(id)).json();
    expect(first.data.viewsCount).toBe(1);
    expect(second.data.viewsCount).toBe(1);

    expect((await view('no-such-callout')).status).toBe(404);
  });
});
