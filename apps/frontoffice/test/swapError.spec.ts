import { describe, expect, it } from 'vitest';
import { swapErrorMessage } from '../src/lib/swap-error';

describe('swapErrorMessage', () => {
  it('names a slippage revert instead of showing its selector', () => {
    const err = {
      shortMessage: 'Execution reverted with reason: custom error 0xbb2875c3.',
      message: 'Execution reverted with reason: custom error 0xbb2875c3.\nRequest Arguments: …',
    };
    expect(swapErrorMessage(err)).toMatch(/slippage/);
  });

  it('keeps only the first line of any other error', () => {
    expect(swapErrorMessage({ message: 'RPC down\nRequest Arguments: from: 0x…' })).toBe(
      'RPC down',
    );
    expect(swapErrorMessage(null)).toBe('Swap execution failed');
  });
});
