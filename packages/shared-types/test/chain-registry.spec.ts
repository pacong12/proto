import { describe, it, expect } from 'vitest';
import { getChainMathConfig, CHAIN_MATH_CONFIGS } from '@proto/math-sdk';
import { CHAIN_ABIS, getFactoryV2Abi } from '@proto/contracts-abi';
import {
  CHAINS,
  DEFAULT_NETWORK,
  SUPPORTED_CHAINS,
  ROBINHOOD_NETWORK,
  ARC_NETWORK,
  ARC_PROTO_CURVE_ADDRESS,
  resolveNetworkByParam,
  resolveTokenNetwork,
} from '../src';

/**
 * Guards the "one module per chain + one registry line" contract: a chain added to
 * one package but forgotten in another fails here instead of at runtime.
 */
describe('chain registry', () => {
  it('has unique chain IDs and slugs', () => {
    expect(new Set(CHAINS.map((c) => c.chainId)).size).toBe(CHAINS.length);
    expect(new Set(CHAINS.map((c) => c.slug)).size).toBe(CHAINS.length);
    expect(Object.keys(SUPPORTED_CHAINS)).toHaveLength(CHAINS.length);
    expect(DEFAULT_NETWORK).toBe(CHAINS[0]);
  });

  it('registers the same chains in shared-types, math-sdk and contracts-abi', () => {
    const ids = (list: readonly { chainId: number }[]) => list.map((c) => c.chainId).sort();
    expect(ids(CHAIN_MATH_CONFIGS)).toEqual(ids(CHAINS));
    expect(ids(CHAIN_ABIS)).toEqual(ids(CHAINS));
  });

  it.each(CHAINS.map((c) => [c.slug, c] as const))(
    '%s: math-sdk matches network config',
    (slug, net) => {
      const math = getChainMathConfig(net.chainId);
      expect(math?.slug).toBe(slug);
      expect(math?.quoteSymbol).toBe(net.nativeCurrency.symbol);
      expect(math?.totalSupply).toBe(net.launchConfigV2?.supply);
      expect(math?.curveSupply).toBe(net.launchConfigV2?.curveTokenAllocation);
      expect(math?.virtualQuoteReserve).toBe(net.launchConfigV2?.virtualReserveWei);
      expect(math?.minPrebuy).toBe(net.launchConfigV2?.minPrebuyWei);
      expect(math?.graduationTarget).toBe(net.launchConfigV2?.graduationTargetWei);
      expect(math?.graduationTarget).toBe(net.launchConfig.graduationThresholdWei);
    },
  );

  it.each(CHAINS.map((c) => [c.slug, c] as const))(
    '%s: contracts-abi slug matches',
    (slug, net) => {
      expect(CHAIN_ABIS.find((a) => a.chainId === net.chainId)?.slug).toBe(slug);
      expect(getFactoryV2Abi(net.chainId)).toBe(
        CHAIN_ABIS.find((a) => a.chainId === net.chainId)?.factoryV2,
      );
    },
  );
});

describe('arc in-pool v4 network', () => {
  it('uses Uniswap v4 only', () => {
    expect(getChainMathConfig(ARC_NETWORK.chainId)?.model).toBe('v4-in-pool');
    const c = ARC_NETWORK.contracts;
    expect([c.uniswapV3Factory, c.positionManager, c.swapRouter, c.quoterV2]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(c.poolManagerV4).toBeDefined();
    expect(c.universalRouter).toBeDefined();
    expect(c.permit2).toBeDefined();
    expect(c.weth).toBe(c.canonicalUsdc);
    expect(ARC_NETWORK.launchConfig.launchFeeWei).toBe(0n);
  });

  it('still resolves tokens from the legacy curve factory to Arc', () => {
    expect(resolveTokenNetwork({ poolAddress: '0xf94d16c9E90fCd55b75D318d0104269146612abF' })).toBe(
      ARC_NETWORK,
    );
  });
});

describe('resolvers', () => {
  it('resolves route params by chain ID, slug, name and native symbol', () => {
    for (const net of CHAINS) {
      expect(resolveNetworkByParam(String(net.chainId))).toBe(net);
      expect(resolveNetworkByParam(net.slug.toUpperCase())).toBe(net);
      expect(resolveNetworkByParam(net.name)).toBe(net);
      expect(resolveNetworkByParam(net.nativeCurrency.symbol)).toBe(net);
    }
    expect(resolveNetworkByParam('unknown')).toBe(DEFAULT_NETWORK);
    expect(resolveNetworkByParam(null)).toBe(DEFAULT_NETWORK);
  });

  it('resolves tokens by chainId, paired token, factory and known addresses', () => {
    expect(resolveTokenNetwork({ chainId: ARC_NETWORK.chainId })).toBe(ARC_NETWORK);
    expect(resolveTokenNetwork({ pairedToken: ARC_NETWORK.contracts.weth.toUpperCase() })).toBe(
      ARC_NETWORK,
    );
    expect(resolveTokenNetwork({ curveAddress: ROBINHOOD_NETWORK.contracts.factory })).toBe(
      ROBINHOOD_NETWORK,
    );
    expect(resolveTokenNetwork({ curveAddress: ARC_PROTO_CURVE_ADDRESS })).toBe(ARC_NETWORK);
    expect(resolveTokenNetwork({ poolAddress: '0x00689B589ADD3EE1995E26E7F4E5CBF262486EB4' })).toBe(
      ARC_NETWORK,
    );
    expect(resolveTokenNetwork(null, ARC_NETWORK.chainId)).toBe(ARC_NETWORK);
    expect(resolveTokenNetwork({ poolAddress: '0xdead' })).toBe(DEFAULT_NETWORK);
  });
});
