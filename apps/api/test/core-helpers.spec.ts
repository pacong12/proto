import { describe, expect, it, vi } from 'vitest';
import { RateLimiter } from '../src/core/middleware/rate-limit.middleware';
import { toEnvelope } from '../src/core/http/api-envelope';
import { assertAddress, NotFoundError } from '../src/core/errors/app-error';
import { InMemoryCacheAdapter } from '../src/modules/observability/infrastructure/in-memory-cache.adapter';
import { GetDevActivityUseCase } from '../src/modules/tokens/application/use-cases/get-dev-activity.use-case';
import { sendAndWait, sentResult } from '../src/modules/tokens/infrastructure/keeper/keeper-tx';
import type { CachePort } from '../src/core/ports/cache.port';
import type { LoggerPort } from '../src/core/ports/logger.port';
import type { TokenRepositoryPort } from '../src/modules/tokens/domain/ports/token.repository.port';
import type { PublicClient, WalletClient } from 'viem';

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerPort;

describe('RateLimiter', () => {
  it('limits per tier and keeps limiting in memory while the shared cache is down', async () => {
    const down = {
      increment: () => Promise.reject(new Error('redis down')),
    } as unknown as CachePort;
    const limiter = new RateLimiter(down, new InMemoryCacheAdapter(), logger);
    expect(await limiter.allow('1.2.3.4', 2, 60_000, 'api')).toBe(true);
    expect(await limiter.allow('1.2.3.4', 2, 60_000, 'api')).toBe(true);
    expect(await limiter.allow('1.2.3.4', 2, 60_000, 'api')).toBe(false);
    // Another tier has its own bucket.
    expect(await limiter.allow('1.2.3.4', 2, 60_000, 'crawler')).toBe(true);
    // The IP is never logged as is.
    const logged = JSON.stringify((logger.warn as ReturnType<typeof vi.fn>).mock.calls);
    expect(logged).not.toContain('1.2.3.4');
  });
});

describe('toEnvelope / assertAddress', () => {
  it('keeps AppError codes and reports anything else under the fail code', async () => {
    expect(await toEnvelope('X_FAILED', async () => 5)).toMatchObject({ success: true, data: 5 });
    expect(
      await toEnvelope('X_FAILED', async () => {
        assertAddress('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');
      }),
    ).toMatchObject({ success: false, error: { code: 'INVALID_ADDRESS' } });
    expect(
      await toEnvelope('X_FAILED', () =>
        Promise.reject(new NotFoundError('gone', 'TOKEN_NOT_FOUND')),
      ),
    ).toMatchObject({ error: { code: 'TOKEN_NOT_FOUND' } });
    expect(await toEnvelope('X_FAILED', () => Promise.reject(new Error('boom')))).toMatchObject({
      error: { code: 'X_FAILED', message: 'boom' },
    });
  });
});

describe('GetDevActivityUseCase', () => {
  const dev = '0x00000000000000000000000000000000000000dd';
  const token = '0x00000000000000000000000000000000000000aa';
  const repo = (percent: number, sold: string[]) =>
    ({
      findByAddress: async () => ({ deployer: dev, initialBuyAmount: '1.5' }),
      getTrades: async () => sold.map((wethAmount) => ({ trader: dev, isBuy: false, wethAmount })),
      getHolders: async () => [{ address: dev, balance: '1', percent }],
    }) as unknown as TokenRepositoryPort;

  it('reports what the creator holds and sold', async () => {
    expect(await new GetDevActivityUseCase(repo(5, [])).execute(token)).toMatchObject({
      creatorStatus: 'holding',
      currentHoldPercent: 5,
    });
    expect(await new GetDevActivityUseCase(repo(0, ['0.25', '0.5'])).execute(token)).toMatchObject({
      creatorStatus: 'sold',
      totalDevSoldEth: '0.7500',
    });
    expect(await new GetDevActivityUseCase(repo(0, [])).execute(token)).toMatchObject({
      creatorStatus: 'none',
    });
  });
});

describe('keeper sendAndWait', () => {
  it('reports a transaction still unmined after the timeout as pending', async () => {
    const wallet = { writeContract: async () => '0xabc' } as unknown as WalletClient;
    const mined = { waitForTransactionReceipt: async () => ({}) } as unknown as PublicClient;
    const stuck = {
      waitForTransactionReceipt: () => Promise.reject(new Error('timeout')),
    } as unknown as PublicClient;
    expect(sentResult(await sendAndWait(mined, wallet, {}))).toEqual({
      executed: true,
      txHash: '0xabc',
    });
    expect(sentResult(await sendAndWait(stuck, wallet, {}))).toEqual({
      executed: true,
      txHash: '0xabc',
      reason: 'Receipt pending',
    });
  });
});
