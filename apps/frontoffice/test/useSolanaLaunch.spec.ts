import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair, Transaction } from '@solana/web3.js';
import { detectSolanaWallets, isSolanaUserRejection } from '../src/chains/solana/solana-wallet';

const creator = Keypair.generate();
const rpc = {
  balance: 5_000_000_000,
  sent: [] as Buffer[],
  confirmErr: null as unknown,
};

vi.mock('@solana/web3.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/web3.js')>();
  class FakeConnection {
    async getMinimumBalanceForRentExemption(size: number) {
      return 6960 * (size + 128);
    }
    async getLatestBlockhash() {
      return { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 100 };
    }
    async getBalance() {
      return rpc.balance;
    }
    async sendRawTransaction(raw: Buffer) {
      rpc.sent.push(raw);
      return 'sig-123';
    }
    async confirmTransaction() {
      return { value: { err: rpc.confirmErr } };
    }
  }
  return { ...actual, Connection: FakeConnection };
});

function phantomProvider(signTransaction?: (tx: Transaction) => Promise<Transaction>) {
  return {
    isPhantom: true,
    publicKey: creator.publicKey,
    connect: vi.fn(async () => ({ publicKey: creator.publicKey })),
    disconnect: vi.fn(async () => undefined),
    signTransaction: vi.fn(
      signTransaction ??
        (async (tx: Transaction) => {
          tx.partialSign(creator);
          return tx;
        }),
    ),
  };
}

const draft = {
  name: 'Proto Cat',
  symbol: 'pcat',
  description: 'A cat',
  image: 'https://gateway.pinata.cloud/ipfs/bafyimage',
  website: 'https://proto.family',
};

async function connectedLaunch(provider = phantomProvider()) {
  vi.stubGlobal('window', { phantom: { solana: provider } });
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
  const { useSolanaWallet } = await import('../src/composables/useSolanaWallet');
  const { useSolanaLaunch } = await import('../src/composables/useSolanaLaunch');
  const wallet = useSolanaWallet();
  await wallet.connect('phantom');
  return { wallet, launcher: useSolanaLaunch(), provider };
}

describe('Solana wallet detection', () => {
  it('detects injected wallets by their provider flags', () => {
    const provider = phantomProvider();
    const detected = detectSolanaWallets({
      phantom: { solana: provider },
      solflare: { isSolflare: false },
    });
    expect(detected.find((w) => w.id === 'phantom')?.installed).toBe(true);
    expect(detected.find((w) => w.id === 'solflare')?.installed).toBe(false);
    expect(detectSolanaWallets(undefined).every((w) => !w.installed)).toBe(true);
  });

  it('recognises wallet rejection errors', () => {
    expect(isSolanaUserRejection({ code: 4001, message: '' })).toBe(true);
    expect(isSolanaUserRejection(new Error('User rejected the request.'))).toBe(true);
    expect(isSolanaUserRejection(new Error('Blockhash not found'))).toBe(false);
  });
});

describe('useSolanaLaunch', () => {
  beforeEach(() => {
    vi.resetModules();
    rpc.balance = 5_000_000_000;
    rpc.sent = [];
    rpc.confirmErr = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({
          success: true,
          data: { url: 'https://gateway.pinata.cloud/ipfs/bafymeta' },
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads metadata, collects both signatures and confirms the launch', async () => {
    const { launcher, provider } = await connectedLaunch();
    const result = await launcher.launch(draft);

    expect(launcher.error.value).toBeNull();
    expect(launcher.step.value).toBe('success');
    expect(result?.signature).toBe('sig-123');
    expect(result?.explorerUrl).toBe(`https://solscan.io/token/${result?.mintAddress}`);

    const metadataCall = vi.mocked(fetch).mock.calls[0];
    expect(metadataCall[0]).toBe('/api/ipfs/metadata');
    expect(JSON.parse((metadataCall[1] as RequestInit).body as string)).toMatchObject({
      name: 'Proto Cat',
      symbol: 'pcat',
      image: 'https://gateway.pinata.cloud/ipfs/bafyimage',
      extensions: { website: 'https://proto.family' },
    });

    expect(provider.signTransaction).toHaveBeenCalledOnce();
    const sent = Transaction.from(rpc.sent[0]);
    expect(sent.feePayer?.equals(creator.publicKey)).toBe(true);
    // Fully signed by creator and mint, and the signatures verify.
    expect(sent.signatures).toHaveLength(2);
    expect(sent.verifySignatures()).toBe(true);
    expect(sent.signatures.some((s) => s.publicKey.toBase58() === result?.mintAddress)).toBe(true);
  });

  it('stops before signing when the wallet cannot cover rent and fees', async () => {
    rpc.balance = 1000;
    const { launcher, provider } = await connectedLaunch();
    expect(await launcher.launch(draft)).toBeNull();
    expect(launcher.step.value).toBe('error');
    expect(launcher.error.value).toMatch(/Insufficient SOL balance/);
    expect(provider.signTransaction).not.toHaveBeenCalled();
  });

  it('reports a wallet rejection without broadcasting', async () => {
    const { launcher } = await connectedLaunch(
      phantomProvider(async () => {
        throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
      }),
    );
    expect(await launcher.launch(draft)).toBeNull();
    expect(launcher.error.value).toBe('Transaction was rejected in the wallet');
    expect(rpc.sent).toHaveLength(0);
  });

  it('surfaces on-chain failures and invalid drafts', async () => {
    rpc.confirmErr = { InstructionError: [0, 'Custom'] };
    const { launcher } = await connectedLaunch();
    expect(await launcher.launch(draft)).toBeNull();
    expect(launcher.error.value).toMatch(/Transaction failed on-chain/);

    expect(await launcher.launch({ name: '', symbol: 'A-B' })).toBeNull();
    expect(launcher.error.value).toMatch(/Token name is required/);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
