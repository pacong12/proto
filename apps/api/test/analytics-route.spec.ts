import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ARC_NETWORK,
  ROBINHOOD_CHAIN,
  type LaunchedTokenEntity,
  type NetworkConfig,
} from '@goton/shared-types';
import { server } from '../src/server';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';

const hex = (bytes: number) =>
  `0x${Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

const HOUR = 3_600_000;
const ARC_TAXED = hex(20);
const ARC_UNTAXED = hex(20);
const ROBINHOOD_TOKEN = hex(20);

async function analytics(query: string) {
  const res = await server.fetch(new Request(`http://localhost:3001/api/analytics${query}`));
  return { status: res.status, body: await res.json() };
}

describe('GET /api/analytics', () => {
  const repository = new SqliteTokenRepository();
  afterAll(() => repository.close());

  const saveToken = (
    address: `0x${string}`,
    network: NetworkConfig,
    createdAt: number,
    taxConfig?: LaunchedTokenEntity['taxConfig'],
  ) =>
    repository.save({
      address,
      name: address,
      symbol: 'TKN',
      decimals: 18,
      totalSupply: '1000000000000000000000000000',
      logo: '',
      description: '',
      socials: {},
      deployer: hex(20),
      pairedToken: network.contracts.weth,
      poolAddress: hex(32),
      curveAddress: hex(20),
      isGraduated: false,
      isToken0: false,
      poolFee: 10000,
      positionId: 0n,
      restrictionsEndBlock: 0n,
      launchBlock: 1n,
      createdAt,
      initialBuyAmount: '0',
      taxConfig,
      version: 'v2',
    } as LaunchedTokenEntity);

  const saveTrade = (
    tokenAddress: `0x${string}`,
    isBuy: boolean,
    wethAmount: string,
    timestamp: number,
  ) =>
    repository.saveTrade({
      id: hex(32),
      tokenAddress,
      poolAddress: hex(32),
      trader: hex(20),
      isBuy,
      tokenAmount: '1.0000',
      wethAmount,
      priceUsd: 1,
      blockNumber: 1n,
      transactionHash: hex(32),
      timestamp,
    });

  beforeAll(async () => {
    const now = Date.now();
    await saveToken(ARC_TAXED, ARC_NETWORK, now - HOUR, { buyTaxBps: 300, sellTaxBps: 500 });
    await saveToken(ARC_UNTAXED, ARC_NETWORK, now - 48 * HOUR);
    await saveToken(ROBINHOOD_TOKEN, ROBINHOOD_CHAIN, now - HOUR, {
      buyTaxBps: 100,
      sellTaxBps: 100,
    });

    await saveTrade(ARC_TAXED, true, '100.000000', now - HOUR); // newest bucket, 3% tax
    await saveTrade(ARC_TAXED, false, '200.000000', now - 5 * HOUR); // second newest, 5% tax
    await saveTrade(ARC_TAXED, true, '999.000000', now - 25 * HOUR); // outside the window
    await saveTrade(ARC_UNTAXED, true, '50.000000', now - HOUR);
    await saveTrade(ROBINHOOD_TOKEN, true, '0.500000', now - HOUR);

    for (const [network, wethSpent, tokensBurned] of [
      [ARC_NETWORK, '2500000', '1000000000000000000000'], // 2.5 USDC, 1,000 tokens
      [ROBINHOOD_CHAIN, '1000000000000000000', '5000000000000000000000'], // 1 ETH, 5,000 tokens
    ] as const) {
      await repository.recordBuybackBurn({
        tokenAddress: network === ARC_NETWORK ? ARC_TAXED : ROBINHOOD_TOKEN,
        network: String(network.chainId),
        wethSpent,
        tokensBurned,
        transactionHash: hex(32),
        timestamp: now - HOUR,
      });
    }
  });

  it.each(['', '?chainId=999999', '?chain=not-a-chain', '?chainId=5042abc'])(
    'rejects %j with 400 instead of showing another network',
    async (query) => {
      const { status, body } = await analytics(query);
      expect(status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_PARAM');
    },
  );

  it("reports only Arc's tokens and trades, in USDC", async () => {
    const { status, body } = await analytics(`?chainId=${ARC_NETWORK.chainId}`);
    expect(status).toBe(200);
    expect(body.data).toMatchObject({
      chainId: ARC_NETWORK.chainId,
      quoteSymbol: 'USDC',
      quoteDecimals: 6,
      quotePriceUsd: 1,
      totalTokens: 2,
      tokensLaunched24h: 1,
      totalVolume: 350,
      totalVolumeQuote: '350.000000',
    });
  });

  it("reports only Robinhood's tokens and trades, in ETH", async () => {
    const { status, body } = await analytics(`?chain=${ROBINHOOD_CHAIN.slug}`);
    expect(status).toBe(200);
    expect(body.data).toMatchObject({
      chainId: ROBINHOOD_CHAIN.chainId,
      quoteSymbol: ROBINHOOD_CHAIN.nativeCurrency.symbol,
      quoteDecimals: 18,
      totalTokens: 1,
      totalVolumeQuote: '0.500000',
    });
  });

  it('estimates tax from each token buy/sell tax and counts trades without tax data', async () => {
    const { body } = await analytics(`?chainId=${ARC_NETWORK.chainId}`);
    expect(body.data.taxFees).toEqual({
      estimated: true,
      totalQuote: '13.000000', // 100 x 3% + 200 x 5%
      totalUsd: '13.00',
      tradesWithoutTaxData: 1,
    });
  });

  it('reports indexed burns of the requested network only, in its decimals', async () => {
    const arc = await analytics(`?chainId=${ARC_NETWORK.chainId}`);
    expect(arc.body.data.buyback).toEqual({
      source: 'indexed',
      totalBurns: 1,
      totalBurnedTokens: '1000',
      totalBuybackQuote: '2.5',
      totalBuybackUsd: '2.50',
    });
    const robinhood = await analytics(`?chainId=${ROBINHOOD_CHAIN.chainId}`);
    expect(robinhood.body.data.buyback).toMatchObject({
      totalBurns: 1,
      totalBurnedTokens: '5000',
      totalBuybackQuote: '1',
    });
  });

  it('returns six 4-hour buckets ending now, oldest first', async () => {
    const { body } = await analytics(`?chainId=${ARC_NETWORK.chainId}`);
    const { volumeHistory, tokenHistory, feeHistory, windowEnd } = body.data;
    expect(volumeHistory.map((b: { label: string }) => b.label)).toEqual([
      '-20h',
      '-16h',
      '-12h',
      '-8h',
      '-4h',
      'now',
    ]);
    expect(volumeHistory.at(-1).end).toBe(windowEnd);
    expect(volumeHistory.map((b: { value: number }) => b.value)).toEqual([0, 0, 0, 0, 200, 150]);
    expect(feeHistory.map((b: { value: number }) => b.value)).toEqual([0, 0, 0, 0, 10, 3]);
    expect(tokenHistory.map((b: { value: number }) => b.value)).toEqual([0, 0, 0, 0, 0, 1]);
  });
});
