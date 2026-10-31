import { describe, it, expect } from 'vitest';
import {
  ROBINHOOD_NETWORK,
  UNDEPLOYED,
  limitOrderContractOf,
  limitOrderContracts,
  limitOrderKey,
  originalLimitOrders,
} from '../src';

const A = '0x00000000000000000000000000000000000000a1' as const;
const B = '0x00000000000000000000000000000000000000b2' as const;
const C = '0x00000000000000000000000000000000000000c3' as const;
const net = (limitOrders: `0x${string}`, limitOrdersPrevious?: `0x${string}`[]) => ({
  ...ROBINHOOD_NETWORK,
  contracts: { ...ROBINHOOD_NETWORK.contracts, limitOrders, limitOrdersPrevious },
});

describe('limit order deployments', () => {
  it('lists the current deployment first, then earlier ones newest first', () => {
    expect(limitOrderContracts(net(C, [A, B]))).toEqual([C, B, A]);
    expect(originalLimitOrders(net(C, [A, B]))).toBe(A);
  });

  it('with one deployment, it is also the original', () => {
    expect(limitOrderContracts(net(A))).toEqual([A]);
    expect(originalLimitOrders(net(A))).toBe(A);
  });

  it('skips undeployed and repeated addresses', () => {
    const upper = A.toUpperCase().replace('0X', '0x') as `0x${string}`;
    const listed = limitOrderContracts(net(UNDEPLOYED, [A, upper]));
    expect(listed.map((a) => a.toLowerCase())).toEqual([A]);
    expect(originalLimitOrders(net(UNDEPLOYED))).toBeNull();
  });

  it('places orders without a recorded contract in the original deployment', () => {
    expect(limitOrderContractOf(net(B, [A]), {})).toBe(A);
    expect(limitOrderContractOf(net(B, [A]), { contract: B })).toBe(B);
  });

  it('keys orders by chain, contract and id', () => {
    expect(limitOrderKey(4663, B.toUpperCase(), 7n)).toBe(`4663-${B.toLowerCase()}-7`);
  });
});
