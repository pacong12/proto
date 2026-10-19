import { describe, expect, it } from 'vitest';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';
import type { TokenRepositoryPort } from '../src/modules/tokens/domain/ports/token.repository.port';

const A = '0x00000000000000000000000000000000000000Aa';
const B = '0x00000000000000000000000000000000000000Bb';
const C = '0x00000000000000000000000000000000000000Cc';

describe.each([
  ['in-memory', () => new InMemoryTokenRepository() as TokenRepositoryPort],
  ['sqlite', () => new SqliteTokenRepository(':memory:') as TokenRepositoryPort],
])('follows (%s)', (_name, make) => {
  it('toggles a follow and counts both sides, case-insensitively', async () => {
    const repo = make();
    expect(await repo.toggleFollow!(A, B)).toEqual({ following: true, followers: 1 });
    await repo.toggleFollow!(C, B.toLowerCase());
    expect(await repo.getFollowStats!(B, A.toLowerCase())).toEqual({
      followers: 2,
      following: 0,
      isFollowing: true,
    });
    expect(await repo.getFollowStats!(A)).toMatchObject({ followers: 0, following: 1 });

    expect(await repo.toggleFollow!(A, B)).toEqual({ following: false, followers: 1 });
    expect((await repo.getFollowStats!(B, A)).isFollowing).toBe(false);
  });

  it('lists followers and following', async () => {
    const repo = make();
    await repo.toggleFollow!(A, B);
    await repo.toggleFollow!(C, B);
    await repo.toggleFollow!(B, C);
    const followers = (await repo.listFollows!(B, 'followers')).map((r) => r.address).sort();
    expect(followers).toEqual([A.toLowerCase(), C.toLowerCase()]);
    expect((await repo.listFollows!(B, 'following')).map((r) => r.address)).toEqual([
      C.toLowerCase(),
    ]);
  });
});
