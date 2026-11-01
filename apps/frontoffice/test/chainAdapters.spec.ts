import { describe, expect, it } from 'vitest';
import { CHAINS, DEFAULT_NETWORK, ARC_NETWORK, ROBINHOOD_NETWORK } from '@goton/shared-types';
import { BondingCurveChainAdapter, InPoolV4ChainAdapter, getChainAdapter } from '../src/chains';

describe('chain adapters', () => {
  it('gives every registered chain an adapter for its own network', () => {
    for (const net of CHAINS) {
      expect(getChainAdapter(net.chainId).network).toBe(net);
    }
  });

  it('picks the adapter by launch model', () => {
    expect(getChainAdapter(ROBINHOOD_NETWORK.chainId)).toBeInstanceOf(BondingCurveChainAdapter);
    expect(getChainAdapter(ARC_NETWORK.chainId)).toBeInstanceOf(InPoolV4ChainAdapter);
  });

  it('falls back to the default network', () => {
    expect(getChainAdapter(1).network).toBe(DEFAULT_NETWORK);
    expect(getChainAdapter().network).toBe(DEFAULT_NETWORK);
  });
});
