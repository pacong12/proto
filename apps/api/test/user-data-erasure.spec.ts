import { describe, it, expect } from 'vitest';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';
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
  it('removes a wallet’s social data and keeps counters on others’ posts consistent', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.saveComment(comment('bob-post', BOB));
    await repo.saveComment(comment('alice-post', ALICE));
    await repo.saveComment(comment('alice-reply', ALICE, 'bob-post'));
    await repo.toggleCommentLike('bob-post', ALICE);
    await repo.toggleCommentLike('alice-post', BOB);
    await repo.voteTokenSentiment(TOKEN, ALICE, 'bull');
    await repo.saveProfile(ALICE, {
      displayName: 'Alice',
      bio: '',
      avatarUrl: '',
      bannerUrl: '',
      twitter: '',
      telegram: '',
    });

    const deleted = await repo.deleteUserData(ALICE.toUpperCase().replace('0X', '0x'));
    expect(deleted).toEqual({ comments: 2, likes: 1, reposts: 0, sentiment: 1, profile: 1 });

    const remaining = await repo.getComments(TOKEN);
    expect(remaining.map((c) => c.id)).toEqual(['bob-post']);
    expect(remaining[0]).toMatchObject({ likesCount: 0, repliesCount: 0 });
    expect(await repo.getProfile(ALICE)).toBeNull();
  });

  it('requires the wallet owner’s session', async () => {
    const erase = (sessionFor?: string) =>
      server.fetch(
        new Request(`http://localhost:3001/api/users/${ALICE}/data`, {
          method: 'DELETE',
          headers: sessionFor
            ? { Authorization: `Bearer ${createSessionToken(sessionFor).token}` }
            : {},
        }),
      );
    expect((await erase()).status).toBe(401);
    expect((await erase(BOB)).status).toBe(403);
    expect((await erase(ALICE)).status).toBe(200);
  });
});
