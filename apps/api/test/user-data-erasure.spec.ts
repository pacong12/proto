import { describe, it, expect, vi, afterEach } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { buildEraseDataSignMessage, LEGACY_SIGNATURES_ACCEPTED_UNTIL } from '@goton/shared-types';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';
import { createSessionToken } from '../src/core/auth/session';
import { server } from '../src/server';

const TOKEN = '0x1111111111111111111111111111111111111111';
const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BOB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function comment(id: string, author: string, parentId?: string) {
  return {
    id,
    tokenAddress: TOKEN,
    authorAddress: author,
    content: id,
    likesCount: 0,
    parentId,
    createdAt: 1,
  };
}

describe('User data erasure (GRC-04)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes a wallet’s social data and keeps counters on others’ posts consistent', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.saveComment(comment('bob-post', BOB));
    await repo.saveComment(comment('alice-post', ALICE));
    await repo.saveComment(comment('alice-reply', ALICE, 'bob-post'));
    await repo.toggleCommentLike('bob-post', ALICE);
    await repo.toggleCommentLike('alice-post', BOB);
    await repo.voteTokenSentiment(TOKEN, ALICE, 'bull');
    await repo.toggleFollow(ALICE, BOB);
    await repo.toggleFollow(BOB, ALICE);
    await repo.saveProfile(ALICE, {
      displayName: 'Alice',
      bio: '',
      avatarUrl: '',
      bannerUrl: '',
      twitter: '',
      telegram: '',
    });

    const deleted = await repo.deleteUserData(ALICE.toUpperCase().replace('0X', '0x'));
    expect(deleted).toEqual({
      comments: 2,
      likes: 1,
      reposts: 0,
      sentiment: 1,
      profile: 1,
      follows: 2,
    });

    const remaining = await repo.getComments(TOKEN);
    expect(remaining.map((c) => c.id)).toEqual(['bob-post']);
    expect(remaining[0]).toMatchObject({ likesCount: 0, repliesCount: 0 });
    expect(await repo.getProfile(ALICE)).toBeNull();
    expect(await repo.listFollows(BOB, 'followers', 10)).toEqual([]);
    expect(await repo.listFollows(BOB, 'following', 10)).toEqual([]);
  });

  it('takes every reply and quote of the wallet off the counts of the posts they answered', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.saveComment(comment('bob-post', BOB));
    await repo.saveComment(comment('bob-reply', BOB, 'bob-post'));
    for (const id of ['r1', 'r2', 'r3']) await repo.saveComment(comment(id, ALICE, 'bob-post'));
    await repo.saveComment({ ...comment('q1', ALICE), quotedCalloutId: 'bob-post' });
    await repo.saveComment({ ...comment('q2', ALICE), quotedCalloutId: 'bob-post' });

    await repo.deleteUserData(ALICE);

    const [post] = (await repo.getComments(TOKEN)).filter((c) => c.id === 'bob-post');
    expect(post).toMatchObject({ repliesCount: 1, quotesCount: 0 });
  });

  it('requires a fresh delete-my-data signature from the wallet, not a session', async () => {
    const alice = privateKeyToAccount(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    );
    const bob = privateKeyToAccount(
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    );
    const erase = (body?: object, sessionFor?: string) =>
      server.fetch(
        new Request(`http://localhost:3001/api/users/${alice.address}/data`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionFor
              ? { Authorization: `Bearer ${createSessionToken(sessionFor).token}` }
              : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
    const signed = async (signer = alice, issuedAt = Date.now()) => ({
      issuedAt,
      signature: await signer.signMessage({
        message: buildEraseDataSignMessage({ address: alice.address, issuedAt }),
      }),
    });

    expect((await erase()).status).toBe(401);
    expect((await erase(await signed(bob))).status).toBe(403);
    expect((await erase(await signed(alice, Date.now() - 11 * 60 * 1000))).status).toBe(401);
    expect((await erase(await signed())).status).toBe(200);

    // During the transition a session token still works (tabs opened before the release)...
    expect((await erase(undefined, bob.address)).status).toBe(403);
    expect((await erase(undefined, alice.address)).status).toBe(200);
    // ...and after it, a session alone no longer erases data.
    const after = LEGACY_SIGNATURES_ACCEPTED_UNTIL + 60_000;
    vi.spyOn(Date, 'now').mockReturnValue(after);
    expect((await erase(undefined, alice.address)).status).toBe(401);
    expect((await erase(await signed(alice, after))).status).toBe(200);
  });
});
