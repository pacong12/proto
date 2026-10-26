import { describe, it, expect } from 'vitest';
import type { LaunchedTokenEntity } from '@goton/shared-types';
import { findAllTokens } from '../src/modules/tokens/application/all-tokens';

const tokens = Array.from(
  { length: 1234 },
  (_, i) => ({ address: `0x${i}` }) as LaunchedTokenEntity,
);

describe('findAllTokens', () => {
  it('reads every page, not only the first', async () => {
    const pages: Array<[number, number]> = [];
    const repository = {
      findAll: async (limit = 50, offset = 0) => {
        pages.push([limit, offset]);
        return tokens.slice(offset, offset + limit);
      },
    };
    const all = await findAllTokens(repository);
    expect(all).toHaveLength(1234);
    expect(pages).toEqual([
      [500, 0],
      [500, 500],
      [500, 1000],
    ]);
  });

  it('passes filters through to every page', async () => {
    const seen: unknown[] = [];
    await findAllTokens(
      {
        findAll: async (_l, _o, filters) => {
          seen.push(filters);
          return [];
        },
      },
      { version: 'v2' },
    );
    expect(seen).toEqual([{ version: 'v2' }]);
  });
});
