import { describe, it, expect } from 'vitest';
import { createWalletClient, custom, defineChain, parseAbi, type PublicClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sendAndWait } from '../src/modules/tokens/infrastructure/keeper/keeper-tx';

const chain = defineChain({
  id: 5042002,
  name: 'test',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['http://localhost'] } },
});
const abi = parseAbi(['function poke()']);
const TO = '0x00000000000000000000000000000000000000aa';
const HASH = `0x${'ab'.repeat(32)}`;

/** A public RPC: it broadcasts signed transactions and refuses to sign any itself. */
function publicRpc(methods: string[]) {
  return custom({
    request: async ({ method }: { method: string }) => {
      methods.push(method);
      switch (method) {
        case 'eth_chainId':
          return `0x${chain.id.toString(16)}`;
        case 'eth_getTransactionCount':
          return '0x1';
        case 'eth_gasPrice':
        case 'eth_maxPriorityFeePerGas':
          return '0x1';
        case 'eth_estimateGas':
          return '0x5208';
        case 'eth_getBlockByNumber':
          return { baseFeePerGas: '0x1', number: '0x1' };
        case 'eth_sendRawTransaction':
          return HASH;
        default:
          throw new Error(`method not supported: ${method}`);
      }
    },
  });
}

describe('sendAndWait', () => {
  const publicClient = {
    estimateContractGas: async () => 100_000n,
    waitForTransactionReceipt: async () => ({ status: 'success' }),
  } as unknown as PublicClient;

  it('signs locally when the simulated request names the keeper by address', async () => {
    const methods: string[] = [];
    const account = privateKeyToAccount(generatePrivateKey());
    const walletClient = createWalletClient({ account, chain, transport: publicRpc(methods) });
    // What simulateContract returns when it is given the address from getAddresses().
    const request = { address: TO, abi, functionName: 'poke', account: account.address };

    const sent = await sendAndWait(publicClient, walletClient, request);

    expect(sent).toEqual({ txHash: HASH, pending: false, reverted: false });
    expect(methods).toContain('eth_sendRawTransaction');
    expect(methods).not.toContain('eth_sendTransaction');
  });
});
