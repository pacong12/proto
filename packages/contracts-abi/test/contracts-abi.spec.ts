import { describe, it, expect } from 'vitest';
import {
  bondingCurveAbi,
  launchpadTokenAbi,
  launchpadV2FactoryAbi,
  launchpadV2FactoryArcAbi,
  holderFeeDistributorAbi,
  buybackBurnerAbi,
  liquidityLockerAbi,
  vestingVaultAbi,
  uniswapV3PoolAbi,
  swapRouterAbi,
  getFactoryV2Abi,
} from '../src';

describe('Contracts ABI Package', () => {
  it('exports all active V2 canonical contract ABIs', () => {
    expect(Array.isArray(bondingCurveAbi)).toBe(true);
    expect(bondingCurveAbi.length).toBeGreaterThan(30);

    expect(Array.isArray(launchpadTokenAbi)).toBe(true);
    expect(launchpadTokenAbi.length).toBeGreaterThan(30);

    expect(Array.isArray(launchpadV2FactoryAbi)).toBe(true);
    expect(launchpadV2FactoryAbi.length).toBeGreaterThan(20);

    expect(Array.isArray(launchpadV2FactoryArcAbi)).toBe(true);
    expect(launchpadV2FactoryArcAbi.length).toBeGreaterThan(20);

    expect(Array.isArray(holderFeeDistributorAbi)).toBe(true);
    expect(holderFeeDistributorAbi.length).toBeGreaterThan(10);

    expect(Array.isArray(buybackBurnerAbi)).toBe(true);
    expect(buybackBurnerAbi.length).toBeGreaterThan(20);

    expect(Array.isArray(liquidityLockerAbi)).toBe(true);
    expect(liquidityLockerAbi.length).toBeGreaterThan(20);

    expect(Array.isArray(vestingVaultAbi)).toBe(true);
    expect(vestingVaultAbi.length).toBeGreaterThan(10);
  });

  it('getFactoryV2Abi returns appropriate factory ABI by chain ID', () => {
    expect(getFactoryV2Abi(5042)).toBe(launchpadV2FactoryArcAbi);
    expect(getFactoryV2Abi(4663)).toBe(launchpadV2FactoryAbi);
    expect(getFactoryV2Abi()).toBe(launchpadV2FactoryAbi);
  });

  it('contains expected functions on BondingCurve ABI', () => {
    const functionNames = (bondingCurveAbi as Array<{ type: string; name?: string }>)
      .filter((item) => item.type === 'function')
      .map((item) => item.name);

    expect(functionNames).toContain('buy');
    expect(functionNames).toContain('buyFor');
    expect(functionNames).toContain('sell');
    expect(functionNames).toContain('getAmountOutBuy');
    expect(functionNames).toContain('getAmountOutSell');
    expect(functionNames).toContain('currentSnipeTaxBps');
  });

  it('contains expected functions on LaunchpadToken ABI', () => {
    const functionNames = (launchpadTokenAbi as Array<{ type: string; name?: string }>)
      .filter((item) => item.type === 'function')
      .map((item) => item.name);

    expect(functionNames).toContain('transfer');
    expect(functionNames).toContain('transferFrom');
    expect(functionNames).toContain('balanceOf');
    expect(functionNames).toContain('proposeTaxConfig');
    expect(functionNames).toContain('acceptTaxConfig');
    expect(functionNames).toContain('cancelTaxConfig');
  });

  it('exports external DEX ABIs', () => {
    expect(Array.isArray(uniswapV3PoolAbi)).toBe(true);
    expect(Array.isArray(swapRouterAbi)).toBe(true);
  });
});
