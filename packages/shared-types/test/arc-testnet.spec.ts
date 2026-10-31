import { describe, expect, it } from 'vitest';

describe('Arc network on testnet (ARC_CHAIN_ID=5042002)', () => {
  it('uses the testnet RPC and never falls back to a mainnet endpoint', async () => {
    process.env.ARC_CHAIN_ID = '5042002';
    delete process.env.ARC_RPC_URL;
    const { ARC_NETWORK } = await import('../src/chains/arc');
    expect(ARC_NETWORK.chainId).toBe(5042002);
    expect(ARC_NETWORK.rpcUrls).toEqual(['https://rpc.testnet.arc.network']);
    delete process.env.ARC_CHAIN_ID;
  });
});
