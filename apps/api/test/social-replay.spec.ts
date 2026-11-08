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

describe('Comment signatures and views', () => {
  it('accepts a signed comment once and refuses the same signature again', async () => {
    const body = await signedComment('replay me');
    expect((await post(body)).status).toBe(201);

    const replay = await post({ ...body, imageUrl: 'https://example.com/x.png' });
    expect(replay.status).toBe(409);
    expect((await replay.json()).error.code).toBe('SIGNATURE_REUSED');
  });
});
