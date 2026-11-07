import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computed, nextTick, ref } from 'vue';
import { ARC_CHAIN, type LaunchedTokenEntity, type TokenMarketData } from '@goton/shared-types';
import type { TradePage } from '../src/composables/trade/types';
import type { UseTradeMarket } from '../src/composables/trade/useTradeMarket';
import type { UseTradeTax } from '../src/composables/trade/useTradeTax';
import type { UseTradeDividends } from '../src/composables/trade/useTradeDividends';

const TOKEN = '0x00000000000000000000000000000000000000a1' as const;
const WALLET = '0x00000000000000000000000000000000000000b1' as const;
// Spot 0.000001 USDC per token, the quote being currency1: 1e-18 quote raw per token raw.
const SQRT_PRICE = 2n ** 96n / 1_000_000_000n;

const mocks = vi.hoisted(() => ({
  account: { value: null as string | null },
  quotePoolSwap: vi.fn(),
  readContract: vi.fn(),
  readV4PoolState: vi.fn(),
}));

vi.mock('@/composables/useWallet', async () => {
  const { ref } = await import('vue');
  const account = ref<string | null>(null);
  mocks.account = account;
  return {
    useWallet: () => ({
      account,
      activeNetwork: ref({ chainId: 0 }),
      balanceWei: ref(0n),
      isConnected: ref(false),
      updateBalance: vi.fn(),
    }),
  };
});
vi.mock('@/lib/viem-client', () => ({
  getPublicClient: () => ({ readContract: mocks.readContract }),
  waitForReceiptWithFallback: vi.fn(),
}));
vi.mock('@/chains', () => ({
  getChainAdapter: () => ({ quotePoolSwap: mocks.quotePoolSwap }),
}));
vi.mock('@goton/shared-types', async (original) => ({
  ...(await original<typeof import('@goton/shared-types')>()),
  readV4PoolState: mocks.readV4PoolState,
}));

// 100M tokens and 100 USDC of virtual reserves at that price: selling 1M tokens moves it ~1%.
const LIQUIDITY = 10n ** 17n;

const { useTradeForm } = await import('../src/composables/trade/useTradeForm');
const { poolOutputFromLiquidity } = await import('../src/lib/pool-preview');
const { useTradeTax } = await import('../src/composables/trade/useTradeTax');

function page(overrides: Partial<LaunchedTokenEntity> = {}) {
  return {
    buyPresets: computed(() => ['1']),
    currencySymbol: computed(() => 'USDC'),
    currentMarketData: ref({ priceInWeth: 0.000001, isGraduated: false } as TokenMarketData),
    currentToken: ref({
      address: TOKEN,
      symbol: 'T',
      decimals: 18,
      version: 'v4',
      ...overrides,
    } as LaunchedTokenEntity),
    explorerUrl: computed(() => ''),
    refreshTokenData: vi.fn(),
    tokenNetwork: computed(() => ARC_CHAIN),
  } as unknown as TradePage;
}

function form(tax = { buyTaxBps: 300, sellTaxBps: 500, taxRecipient: '' }) {
  return useTradeForm(
    page(),
    { quoteAssetPriceUsd: ref(1), selectedResolution: ref('1m') } as unknown as UseTradeMarket,
    { onchainTaxConfig: ref(tax) } as unknown as UseTradeTax,
    {} as UseTradeDividends,
  );
}

const asNumber = (s: string) => Number(s.replace(/,/g, ''));

describe('swap form preview on the pool path', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.account.value = null;
    mocks.quotePoolSwap.mockReset();
    mocks.readV4PoolState.mockReset();
    mocks.readV4PoolState.mockResolvedValue({ sqrtPriceX96: SQRT_PRICE, liquidity: LIQUIDITY });
  });
  afterEach(() => vi.useRealTimers());

  it('takes the tax and the LP fee off a buy when it cannot quote', () => {
    const f = form();
    f.amountIn.value = '1';
    expect(asNumber(f.estimatedOutputAmount.value)).toBeCloseTo(1e6 * 0.99 * 0.97, 1);
    expect(f.priceImpact.value).toBeNull();
  });

  it('takes the tax and the LP fee off a sell when it cannot quote', () => {
    const f = form();
    f.tradeTab.value = 'sell';
    f.amountIn.value = '1000000';
    expect(Number(f.estimatedOutputAmount.value)).toBeCloseTo(1 * 0.99 * 0.95, 2);
  });

  it('shows the real quote and its measured impact once the wallet can simulate', async () => {
    mocks.account.value = WALLET;
    const quoted = BigInt(Math.floor(1e6 * 0.99 * 0.97 * 0.98)) * 10n ** 18n;
    mocks.quotePoolSwap.mockResolvedValue(quoted);
    const f = form();
    f.amountIn.value = '1';
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);

    expect(asNumber(f.estimatedOutputAmount.value)).toBeCloseTo(1e6 * 0.99 * 0.97 * 0.98, 0);
    expect(mocks.quotePoolSwap.mock.calls[0][0]).toMatchObject({
      tokenAddress: TOKEN,
      isBuy: true,
      amountInWei: 10n ** 18n,
    });
    expect(f.priceImpact.value).toBeCloseTo(0.02, 4);
  });

  it('keeps the spot estimate when neither the quote nor the pool can be read', async () => {
    mocks.account.value = WALLET;
    mocks.quotePoolSwap.mockRejectedValue(new Error('reverted'));
    mocks.readV4PoolState.mockRejectedValue(new Error('429'));
    const f = form();
    f.amountIn.value = '1';
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);
    expect(asNumber(f.estimatedOutputAmount.value)).toBeCloseTo(1e6 * 0.99 * 0.97, 1);
    expect(f.priceImpact.value).toBeNull();
  });

  it('prices a sell not approved yet from the pool’s liquidity, impact included', async () => {
    mocks.account.value = WALLET;
    // Without an allowance the router's simulation reverts.
    mocks.quotePoolSwap.mockRejectedValue(new Error('insufficient allowance'));
    const f = form();
    f.tradeTab.value = 'sell';
    f.amountIn.value = '1000000';
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);

    const expected = poolOutputFromLiquidity({
      isBuy: false,
      amountInRaw: 10n ** 24n,
      sqrtPriceX96: SQRT_PRICE,
      liquidity: LIQUIDITY,
      quoteIsCurrency0: false,
      taxBps: 500,
    }) as bigint;
    expect(Number(f.estimatedOutputAmount.value)).toBeCloseTo(Number(expected) / 1e6, 2);
    // Below the spot figure of the test above by the ~1% the sell moves the price.
    expect(Number(expected) / 1e6).toBeLessThan(0.99 * 0.95 * 0.992);
    expect(f.priceImpact.value).toBeGreaterThan(0.009);
    expect(f.priceImpact.value).toBeLessThan(0.011);
  });

  it('prices a pool swap from its liquidity before a wallet is connected', async () => {
    const f = form();
    f.amountIn.value = '1';
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);

    expect(mocks.quotePoolSwap).not.toHaveBeenCalled();
    expect(f.priceImpact.value).toBeGreaterThan(0);
    expect(asNumber(f.estimatedOutputAmount.value)).toBeLessThan(1e6 * 0.99 * 0.97);
  });
});

describe('loadOnchainTax', () => {
  const recipient = '0x00000000000000000000000000000000000000c1';
  beforeEach(() => {
    mocks.readContract.mockReset();
  });

  it("shows an in-pool token's tax from the hook: its own config stays at zero", async () => {
    mocks.readContract.mockImplementation(async (read: { functionName: string }) =>
      read.functionName === 'taxConfig' ? [0, 0, recipient] : [TOKEN, TOKEN, TOKEN, 300, 500],
    );
    const tax = useTradeTax(page());
    await tax.loadOnchainTax(TOKEN);
    expect(tax.onchainTaxConfig.value).toMatchObject({ buyTaxBps: 300, sellTaxBps: 500 });
  });

  it("takes a pool's zero over the token's config, as the deployed graduator registers it", async () => {
    mocks.readContract.mockImplementation(async (read: { functionName: string }) =>
      read.functionName === 'taxConfig' ? [200, 1_000, recipient] : [TOKEN, TOKEN, TOKEN, 0, 0],
    );
    const tax = useTradeTax(
      page({ taxConfig: { buyTaxBps: 200, sellTaxBps: 1_000, taxRecipient: recipient } }),
    );
    await tax.loadOnchainTax(TOKEN);
    expect(tax.onchainTaxConfig.value).toMatchObject({ buyTaxBps: 0, sellTaxBps: 0 });
  });

  it("keeps a curve token's own config and does not ask the hook", async () => {
    mocks.readContract.mockImplementation(async () => [200, 1_000, recipient]);
    const tax = useTradeTax(
      page({ curveAddress: '0x00000000000000000000000000000000000000d1' as `0x${string}` }),
    );
    await tax.loadOnchainTax(TOKEN);
    expect(tax.onchainTaxConfig.value).toMatchObject({ buyTaxBps: 200, sellTaxBps: 1_000 });
    expect(mocks.readContract).toHaveBeenCalledTimes(1);
  });

  it("drops the previous token's tax on an untaxed token", async () => {
    mocks.readContract.mockImplementation(async (read: { functionName: string }) =>
      read.functionName === 'taxConfig' ? [0, 0, recipient] : [TOKEN, TOKEN, TOKEN, 0, 0],
    );
    const tax = useTradeTax(page());
    tax.onchainTaxConfig.value = { buyTaxBps: 300, sellTaxBps: 300, taxRecipient: recipient };
    await tax.loadOnchainTax(TOKEN);
    expect(tax.onchainTaxConfig.value).toMatchObject({ buyTaxBps: 0, sellTaxBps: 0 });
  });
});
