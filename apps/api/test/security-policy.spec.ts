import { describe, it, expect } from 'vitest';
import { SecurityPolicy } from '../src/modules/security/domain/security-policy';
import { TransactionIntent } from '@proto/shared-types';

describe('SecurityPolicy & Security Gate', () => {
  const validSender = '0x1111111111111111111111111111111111111111' as `0x${string}`;
  const validToken = '0x39dBED3a2bd333467115dE45665cC57F813C4571' as `0x${string}`;

  it('allows valid launch token intent on Robinhood Chain', () => {
    const intent: TransactionIntent = {
      id: 'intent-launch-1',
      sender: validSender,
      action: 'LAUNCH_TOKEN',
      chainId: 4663,
      payload: {
        name: 'Rocket Token',
        symbol: 'ROCKET',
        logo: 'ipfs://logo',
        description: 'Test launch',
      },
      timestamp: Date.now(),
    };

    const evaluation = SecurityPolicy.evaluate(intent);
    expect(evaluation.allowed).toBe(true);
    expect(evaluation.suggestedAction).toBe('APPROVE');
  });

  it('rejects intent with invalid chainId (fail-closed)', () => {
    const intent: TransactionIntent = {
      id: 'intent-wrong-chain',
      sender: validSender,
      action: 'LAUNCH_TOKEN',
      chainId: 1, // Ethereum mainnet instead of Robinhood Chain (4663)
      payload: {
        name: 'Rocket Token',
        symbol: 'ROCKET',
        logo: 'ipfs://logo',
        description: 'Test launch',
      },
      timestamp: Date.now(),
    };

    const evaluation = SecurityPolicy.evaluate(intent);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.suggestedAction).toBe('REJECT');
    expect(evaluation.reason).toContain('does not match Robinhood Chain');
  });

  it('rejects swap intent with excessive slippage tolerance (> 50%)', () => {
    const intent: TransactionIntent = {
      id: 'intent-swap-high-slippage',
      sender: validSender,
      action: 'SWAP_BUY',
      chainId: 4663,
      payload: {
        tokenAddress: validToken,
        isBuy: true,
        amountInWei: '100000000000000000',
        minAmountOutWei: '1000000',
        slippageTolerancePercent: 75, // Dangerous 75% slippage
      },
      timestamp: Date.now(),
    };

    const evaluation = SecurityPolicy.evaluate(intent);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.suggestedAction).toBe('REJECT');
    expect(evaluation.reason).toContain('outside safe bounds');
  });
});
