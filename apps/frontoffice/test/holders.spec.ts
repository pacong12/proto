import { describe, expect, it } from 'vitest';
import {
  burnedPercent,
  classifyHolder,
  networkProtocolAddresses,
  top10WalletPercent,
  walletHolders,
  walletPercent,
  type HolderContext,
} from '../src/lib/holders';
import { ARC_NETWORK } from '@goton/shared-types';

const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
const CURVE = '0xF187118b09ccf4f06ae24e22eb9441ce96c7b860';
const POOL_ID = `0x${'ab'.repeat(32)}`;
const DEAD = '0x000000000000000000000000000000000000dEaD';
const ZERO = '0x0000000000000000000000000000000000000000';
const MANAGER = '0x00000000000000000000000000000000000000aa';
const context: HolderContext = {
  tokenAddress: addr(0xbeef),
  curveAddress: CURVE,
  poolAddress: POOL_ID,
  poolManagerAddress: MANAGER,
  protocolAddresses: [addr(0xcafe)],
};

describe('classifyHolder', () => {
  it('names every row nobody can trade from, in any letter case', () => {
    expect(classifyHolder(CURVE.toLowerCase(), context)).toBe('curve');
    expect(classifyHolder(POOL_ID, context)).toBe('pool');
    expect(classifyHolder(MANAGER, context)).toBe('pool');
    expect(classifyHolder(DEAD, context)).toBe('burn');
    expect(classifyHolder(ZERO, context)).toBe('burn');
    expect(classifyHolder(addr(0xbeef), context)).toBe('contract');
    expect(classifyHolder(addr(0xcafe), context)).toBe('contract');
    expect(classifyHolder(addr(1), context)).toBe('wallet');
  });

  it('treats any 32-byte id as a pool, even when it is not this token`s', () => {
    expect(classifyHolder(`0x${'cd'.repeat(32)}`)).toBe('pool');
  });

  it('treats a curve that doubles as the pool address as the curve', () => {
    expect(classifyHolder(CURVE, { curveAddress: CURVE, poolAddress: CURVE })).toBe('curve');
  });
});

describe('holder figures', () => {
  it('shows no concentration for a token still on its curve', () => {
    const holders = [{ address: CURVE, percent: 100 }];
    expect(walletHolders(holders, context)).toEqual([]);
    expect(top10WalletPercent(holders, context)).toBe(0);
    expect(walletPercent(holders, addr(1), context)).toBe(0);
  });

  it('takes the top 10 wallets, past the rows that are not wallets', () => {
    const wallets = Array.from({ length: 12 }, (_, i) => ({
      address: addr(i + 1),
      percent: 12 - i,
    }));
    const holders = [
      { address: POOL_ID, percent: 40 },
      { address: CURVE, percent: 20 },
      { address: DEAD, percent: 5 },
      ...wallets,
    ];
    // 12 + 11 + ... + 3
    expect(top10WalletPercent(holders, context)).toBe(75);
    expect(walletHolders(holders, context)).toHaveLength(12);
  });

  it('finds the creator among the wallets only', () => {
    const holders = [
      { address: CURVE, percent: 90 },
      { address: addr(7), percent: 2.5 },
    ];
    expect(walletPercent(holders, addr(7).toUpperCase().replace('0X', '0x'), context)).toBe(2.5);
    expect(walletPercent(holders, CURVE, context)).toBe(0);
    expect(walletPercent(holders, undefined, context)).toBe(0);
  });

  it('adds both burn addresses to the burned share', () => {
    const holders = [
      { address: DEAD, percent: 3 },
      { address: ZERO, percent: 1.5 },
      { address: addr(2), percent: 9 },
    ];
    expect(burnedPercent(holders)).toBe(4.5);
  });

  it('lists a chain`s contracts without its unset ones', () => {
    const addresses = networkProtocolAddresses(ARC_NETWORK);
    expect(addresses).toContain(ARC_NETWORK.contracts.factory.toLowerCase());
    expect(addresses).not.toContain(ZERO);
    expect(addresses.every((a) => a === a.toLowerCase())).toBe(true);
  });
});
