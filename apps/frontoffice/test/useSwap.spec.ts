import { describe, it, expect } from 'vitest';
import { useSwap } from '../src/composables/useSwap';

describe('useSwap Composable', () => {
  it('initializes with default slippage and idle state', () => {
    const { isSwapping, swapError, slippage } = useSwap();

    expect(isSwapping.value).toBe(false);
    expect(swapError.value).toBeNull();
    expect(slippage.value).toBe(1.0);
  });

  it('allows updating slippage tolerance', () => {
    const { slippage } = useSwap();

    slippage.value = 2.5;
    expect(slippage.value).toBe(2.5);

    slippage.value = 0.5;
    expect(slippage.value).toBe(0.5);
  });

  it('fails gracefully when wallet is not connected', async () => {
    const { executeSwap, swapError, isSwapping } = useSwap();

    const txHash = await executeSwap({
      tokenAddress: '0x1234567890123456789012345678901234567890',
      isBuy: true,
      amountInEth: '0.1',
    });

    expect(txHash).toBeNull();
    expect(swapError.value).toBeTruthy();
    expect(isSwapping.value).toBe(false);
  });
});
