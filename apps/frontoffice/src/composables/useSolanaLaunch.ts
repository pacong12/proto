import { ref } from 'vue';
import {
  SOLANA_NETWORK,
  solanaExplorerUrl,
  validateSolanaTokenDraft,
  type SolanaTokenDraft,
} from '@proto/shared-types';
import { isSolanaUserRejection } from '../chains/solana/solana-wallet';
import { useSolanaWallet } from './useSolanaWallet';

export type SolanaLaunchStep =
  | 'idle'
  | 'validating'
  | 'uploading_metadata'
  | 'awaiting_signature'
  | 'broadcasting'
  | 'confirming'
  | 'success'
  | 'error';

export interface SolanaLaunchSuccess {
  mintAddress: string;
  signature: string;
  explorerUrl: string;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

/** Pin the off-chain metadata JSON (image, description, socials) and return its URL. */
async function uploadMetadata(draft: SolanaTokenDraft): Promise<string> {
  const res = await fetch('/api/ipfs/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: draft.name.trim(),
      symbol: draft.symbol.trim(),
      description: (draft.description ?? '').trim(),
      image: (draft.image ?? '').trim(),
      extensions: {
        website: draft.website?.trim() || undefined,
        twitter: draft.twitter?.trim() || undefined,
        telegram: draft.telegram?.trim() || undefined,
      },
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { url?: string };
    error?: { message?: string };
  } | null;
  if (!body?.success || !body.data?.url) {
    throw new Error(body?.error?.message || 'Failed to upload token metadata');
  }
  return body.data.url;
}

export function useSolanaLaunch() {
  const wallet = useSolanaWallet();
  const step = ref<SolanaLaunchStep>('idle');
  const error = ref<string | null>(null);
  const signature = ref<string | null>(null);
  const mintAddress = ref<string | null>(null);
  const loading = ref(false);

  function reset() {
    step.value = 'idle';
    error.value = null;
    signature.value = null;
    mintAddress.value = null;
    loading.value = false;
  }

  async function launch(draft: SolanaTokenDraft): Promise<SolanaLaunchSuccess | null> {
    reset();
    loading.value = true;
    step.value = 'validating';

    try {
      const problems = validateSolanaTokenDraft(draft);
      if (problems.length > 0) throw new Error(problems.join('. '));

      const provider = wallet.provider.value;
      const owner = wallet.address.value;
      if (!provider || !owner) throw new Error('Connect a Solana wallet first');

      // Heavy Solana libraries are only loaded once a launch actually starts.
      const [{ Connection, PublicKey, Transaction }, service] = await Promise.all([
        import('@solana/web3.js'),
        import('../chains/solana/solana-token.service'),
      ]);
      const connection = new Connection(SOLANA_NETWORK.rpcUrl, 'confirmed');

      step.value = 'uploading_metadata';
      const metadataUri = await uploadMetadata(draft);

      const built = await service.buildSolanaTokenLaunchTransaction(connection, {
        name: draft.name.trim(),
        symbol: draft.symbol.trim().toUpperCase(),
        metadataUri,
        creator: new PublicKey(owner),
      });

      const required = built.rentLamports + service.estimateSolanaNetworkFeeLamports();
      const balance = await connection.getBalance(new PublicKey(owner), 'confirmed');
      if (balance < required) {
        throw new Error(
          `Insufficient SOL balance. About ${(required / LAMPORTS_PER_SOL).toFixed(4)} SOL is needed ` +
            `for rent and network fees, wallet has ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL.`,
        );
      }

      // The wallet signs first (it may add its own safety instructions), then the mint keypair.
      step.value = 'awaiting_signature';
      const signedByWallet = await provider.signTransaction(built.transaction);
      const signed = Transaction.from(
        (signedByWallet as typeof built.transaction).serialize({ requireAllSignatures: false }),
      );
      signed.partialSign(built.mint);

      step.value = 'broadcasting';
      const sig = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
      signature.value = sig;
      mintAddress.value = built.mint.publicKey.toBase58();

      step.value = 'confirming';
      const confirmation = await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: built.transaction.recentBlockhash!,
          lastValidBlockHeight: built.lastValidBlockHeight,
        },
        'confirmed',
      );
      if (confirmation.value.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
      }

      step.value = 'success';
      return {
        mintAddress: mintAddress.value,
        signature: sig,
        explorerUrl: solanaExplorerUrl('token', mintAddress.value),
      };
    } catch (err) {
      step.value = 'error';
      error.value = isSolanaUserRejection(err)
        ? 'Transaction was rejected in the wallet'
        : (err as Error)?.message || 'Solana token launch failed';
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { step, error, signature, mintAddress, loading, launch, reset };
}
