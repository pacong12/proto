import { describe, expect, it } from 'vitest';
import type { CurveState, LaunchedTokenEntity } from '@goton/shared-types';
import { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';

const token = {
  address: '0x1000000000000000000000000000000000000001',
  totalSupply: (10n ** 27n).toString(),
} as unknown as LaunchedTokenEntity;
// A curve frozen at graduation: 4.2 ETH raised, spot 5e-9 ETH per token.
const curve = {
  virtualEthReserve: 5n * 10n ** 18n,
  virtualTokenReserve: 10n ** 27n,
  totalEthRaised: 42n * 10n ** 17n,
  graduationTarget: 42n * 10n ** 17n,
  graduated: true,
} as CurveState;

describe('CalculatePricingUseCase.fromCurve', () => {
  const pricing = new CalculatePricingUseCase();

  it('prices a graduated token at its pool spot, not the frozen curve', () => {
    const md = pricing.fromCurve(token, curve, 2000, 2e-7);
    expect(md.priceUsd).toBeCloseTo(2e-7 * 2000, 12);
    expect(md.marketCapUsd).toBeCloseTo(2e-7 * 2000 * 1e9, 3);
    expect(md.isGraduated).toBe(true);
  });

  it('uses the curve until it graduates, and when no pool trade is known yet', () => {
    const live = { ...curve, graduated: false };
    expect(pricing.fromCurve(token, live, 2000, 2e-7).priceUsd).toBeCloseTo(5e-9 * 2000, 15);
    expect(pricing.fromCurve(token, curve, 2000).priceUsd).toBeCloseTo(5e-9 * 2000, 15);
  });
});
