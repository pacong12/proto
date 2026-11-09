import { describe, it, expect } from 'vitest';
import { addressTopic, isLaunchReceiptFor, logsFrom } from '../src/core/receipt-guards';

const TOKEN = '0x1111111111111111111111111111111111111111';
const CURVE = '0x2222222222222222222222222222222222222222';
const FACTORY = '0x3333333333333333333333333333333333333333';
const ATTACKER = '0x4444444444444444444444444444444444444444';
const network = { contracts: { factory: FACTORY, factoryV2: FACTORY } };
const launchTopic = '0x' + 'ab'.repeat(32);

describe('Receipt guards for caller-supplied tx hashes', () => {
  it('keeps only logs emitted by the token’s own contracts', () => {
    const logs = [
      { address: CURVE.toUpperCase().replace('0X', '0x'), topics: [], id: 'real' },
      { address: ATTACKER, topics: [], id: 'forged' },
    ];
    expect(logsFrom(logs, [CURVE, undefined]).map((l) => l.id)).toEqual(['real']);
    expect(logsFrom(logs, [])).toEqual([]);
  });

  it('accepts a receipt as a launch only for the factory’s event about this token', () => {
    const launch = { address: FACTORY, topics: [launchTopic, addressTopic(TOKEN)] };
    expect(isLaunchReceiptFor({ logs: [launch] }, TOKEN, network)).toBe(true);
    // Same event shape from another contract, or the factory launching another token.
    expect(isLaunchReceiptFor({ logs: [{ ...launch, address: ATTACKER }] }, TOKEN, network)).toBe(
      false,
    );
    expect(
      isLaunchReceiptFor(
        { logs: [{ address: FACTORY, topics: [launchTopic, addressTopic(CURVE)] }] },
        TOKEN,
        network,
      ),
    ).toBe(false);
    expect(isLaunchReceiptFor({ logs: [] }, TOKEN, network)).toBe(false);
  });
});
