import { describe, expect, it } from 'vitest';
import { txErrorMessage } from '../src/lib/tx-error';

describe('txErrorMessage', () => {
  it('names a slippage revert instead of showing its selector', () => {
    const err = {
      shortMessage: 'Execution reverted with reason: custom error 0xbb2875c3.',
      message: 'Execution reverted with reason: custom error 0xbb2875c3.\nRequest Arguments: …',
    };
    expect(txErrorMessage(err)).toMatch(/slippage/);
  });

  it('keeps only the first line of any other error', () => {
    expect(txErrorMessage({ message: 'RPC down\nRequest Arguments: from: 0x…' })).toBe('RPC down');
    expect(txErrorMessage(null, 'Swap execution failed')).toBe('Swap execution failed');
  });
});
