import { describe, it, expect } from 'vitest';
import { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';

describe('CalculatePricingUseCase', () => {
  const useCase = new CalculatePricingUseCase();
  const sampleTokenAddress = '0x39dBED3a2bd333467115dE45665cC57F813C4571' as `0x${string}`;

  it('calculates price, market cap, and graduation progress correctly', () => {
    // sqrtPriceX96 for ~1e-9 ratio (2505414483750479299401734)
    const sqrtPriceX96 = 2505414483750479299401734n;
    const pairedPrincipalWei = 2_100_000_000_000_000_000n; // 2.1 ETH (50% of 4.2 ETH)

    const result = useCase.execute({
      address: sampleTokenAddress,
      sqrtPriceX96,
      isToken0: true,
      pairedPrincipalWei,
      ethPriceUsd: 3000,
    });

    expect(result.address).toBe(sampleTokenAddress);
    expect(result.priceInWeth).toBeGreaterThan(0);
    expect(result.priceUsd).toBeGreaterThan(0);
    expect(result.marketCapUsd).toBeGreaterThan(0);
    expect(result.fdvUsd).toBe(result.marketCapUsd);
    expect(result.graduationProgress).toBeCloseTo(0.5, 2);
    expect(result.isGraduated).toBe(false);
  });

  it('marks token as graduated when paired principal reaches 4.2 ETH threshold', () => {
    const sqrtPriceX96 = 2505414483750479299401734n;
    const pairedPrincipalWei = 4_200_000_000_000_000_000n; // 4.2 ETH

    const result = useCase.execute({
      address: sampleTokenAddress,
      sqrtPriceX96,
      isToken0: true,
      pairedPrincipalWei,
    });

    expect(result.graduationProgress).toBe(1.0);
    expect(result.isGraduated).toBe(true);
  });
});
