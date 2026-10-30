import { describe, it, expect } from 'vitest';
import { ROBINHOOD_CHAIN, ARC_CHAIN, type LaunchedTokenEntity } from '@goton/shared-types';
import { SourceVerifyKeeperService } from '../src/modules/tokens/infrastructure/keeper/source-verify-keeper.service';

const BASE = 'https://sourcify.test/server';

function token(n: number, overrides: Partial<LaunchedTokenEntity> = {}): LaunchedTokenEntity {
  const address = `0x${n.toString(16).padStart(40, '0')}` as `0x${string}`;
  const curve = `0x${(n + 0x100).toString(16).padStart(40, '0')}` as `0x${string}`;
  return {
    address,
    name: 'T',
    symbol: 'T',
    decimals: 18,
    totalSupply: '1',
    logo: '',
    description: '',
    socials: {},
    deployer: address,
    pairedToken: ROBINHOOD_CHAIN.contracts.weth,
    poolAddress: curve,
    curveAddress: curve,
    isToken0: false,
    poolFee: 10_000,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 0n,
    createdAt: 0,
    chainId: ROBINHOOD_CHAIN.chainId,
    version: 'v2',
    isGraduated: false,
    ...overrides,
  };
}

/** A fake Sourcify: `verified` answers the lookup; `similarity` decides the POST status. */
function sourcify(verified: Set<string>, similarity: (key: string) => number = () => 202) {
  const calls: string[] = [];
  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
    const [, kind, chainId, address] =
      url.match(/\/v2\/(contract|verify\/similarity)\/(\d+)\/(0x[0-9a-fA-F]{40})$/) ?? [];
    const key = `${chainId}:${address.toLowerCase()}`;
    calls.push(`${init?.method ?? 'GET'} ${kind} ${key}`);
    if (kind === 'contract') return new Response('{}', { status: verified.has(key) ? 200 : 404 });
    const status = similarity(key);
    const body = status === 409 ? { customCode: 'already_verified' } : { customCode: 'no_match' };
    return new Response(JSON.stringify(status === 202 ? { verificationId: 'job' } : body), {
      status,
    });
  };
  return { fetchFn, calls };
}

function keeper(tokens: LaunchedTokenEntity[], fetchFn: typeof fetch, now = () => 0, max = 10) {
  return new SourceVerifyKeeperService(
    { findAll: async (limit = 500, offset = 0) => tokens.slice(offset, offset + limit) },
    fetchFn,
    BASE,
    max,
    now,
  );
}

const key = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`;

describe('SourceVerifyKeeperService', () => {
  it('submits the token and its curve when Sourcify does not know them', async () => {
    const t = token(1);
    const { fetchFn, calls } = sourcify(new Set());
    const results = await keeper([t], fetchFn as typeof fetch).runOnce();
    expect(results.map((r) => [r.address, r.status])).toEqual([
      [t.address, 'submitted'],
      [t.curveAddress, 'submitted'],
    ]);
    expect(calls).toContain(`POST verify/similarity ${key(4663, t.address)}`);
    expect(calls).toContain(`POST verify/similarity ${key(4663, t.curveAddress!)}`);
  });

  it('remembers verified contracts and stops asking about them', async () => {
    const t = token(2);
    const verified = new Set([key(4663, t.address), key(4663, t.curveAddress!)]);
    const { fetchFn, calls } = sourcify(verified);
    const k = keeper([t], fetchFn as typeof fetch);
    expect((await k.runOnce()).every((r) => r.status === 'verified')).toBe(true);
    calls.length = 0;
    expect(await k.runOnce()).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('treats already_verified as done', async () => {
    const t = token(3, { version: 'v1', curveAddress: undefined });
    const { fetchFn } = sourcify(new Set(), () => 409);
    const [result] = await keeper([t], fetchFn as typeof fetch).runOnce();
    expect(result.status).toBe('verified');
  });

  it('uses the token chain and skips a curve on Arc tokens without one', async () => {
    const t = token(4, {
      chainId: ARC_CHAIN.chainId,
      pairedToken: ARC_CHAIN.contracts.weth,
      curveAddress: undefined,
    });
    const { fetchFn, calls } = sourcify(new Set());
    await keeper([t], fetchFn as typeof fetch).runOnce();
    expect(calls).toEqual([
      `GET contract ${key(ARC_CHAIN.chainId, t.address)}`,
      `POST verify/similarity ${key(ARC_CHAIN.chainId, t.address)}`,
    ]);
  });

  it('backs off a contract that has no similar verified source', async () => {
    const t = token(5, { version: 'v1', curveAddress: undefined });
    let clock = 0;
    const { fetchFn, calls } = sourcify(new Set(), () => 404);
    const k = keeper([t], fetchFn as typeof fetch, () => clock);
    expect((await k.runOnce())[0].status).toBe('failed');
    calls.length = 0;
    clock = 4 * 60_000;
    expect(await k.runOnce()).toEqual([]);
    clock = 5 * 60_000;
    expect(await k.runOnce()).toHaveLength(1);
    clock = 14 * 60_000; // the second wait is 10 minutes
    expect(await k.runOnce()).toEqual([]);
    clock = 15 * 60_000;
    expect(await k.runOnce()).toHaveLength(1);
    expect(calls.filter((c) => c.startsWith('POST'))).toHaveLength(2);
  });

  it('caps the submissions per cycle', async () => {
    const tokens = [token(6), token(7), token(8)];
    const { fetchFn } = sourcify(new Set());
    const results = await keeper(tokens, fetchFn as typeof fetch, () => 0, 3).runOnce();
    expect(results.filter((r) => r.status === 'submitted')).toHaveLength(3);
  });

  it('reports a network error without throwing', async () => {
    const t = token(9, { version: 'v1', curveAddress: undefined });
    const fetchFn = (async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;
    const [result] = await keeper([t], fetchFn).runOnce();
    expect(result).toMatchObject({ status: 'failed', reason: 'ECONNRESET' });
  });
});
