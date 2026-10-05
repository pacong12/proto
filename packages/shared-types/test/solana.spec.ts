import { describe, expect, it } from 'vitest';
import {
  SOLANA_NETWORK,
  isSolanaAddress,
  solanaExplorerUrl,
  validateSolanaTokenDraft,
} from '../src';

describe('Solana network config', () => {
  it('defaults to mainnet-beta with a fixed 1B supply and revoked authorities', () => {
    expect(SOLANA_NETWORK.cluster).toBe('mainnet-beta');
    expect(SOLANA_NETWORK.launchConfig.supply).toBe(1_000_000_000n);
    expect(SOLANA_NETWORK.launchConfig.decimals).toBe(9);
    expect(SOLANA_NETWORK.launchConfig.revokeMintAuthority).toBe(true);
    expect(SOLANA_NETWORK.launchConfig.disableFreezeAuthority).toBe(true);
  });

  it('builds explorer links with the cluster query outside mainnet', () => {
    expect(solanaExplorerUrl('token', 'Mint111')).toBe('https://solscan.io/token/Mint111');
    expect(solanaExplorerUrl('tx', 'sig', { ...SOLANA_NETWORK, cluster: 'devnet' })).toBe(
      'https://solscan.io/tx/sig?cluster=devnet',
    );
  });
});

describe('isSolanaAddress', () => {
  it('accepts valid 32-byte base58 public keys', () => {
    expect(isSolanaAddress('11111111111111111111111111111111')).toBe(true);
    expect(isSolanaAddress('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')).toBe(true);
    expect(isSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
  });

  it('rejects EVM addresses, invalid characters and wrong lengths', () => {
    expect(isSolanaAddress('0x6c1c1a77771bf8961e27ea5b21f575eb17a7626e')).toBe(false);
    expect(isSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt10')).toBe(false);
    expect(isSolanaAddress('abc')).toBe(false);
    expect(isSolanaAddress(null)).toBe(false);
  });
});

describe('validateSolanaTokenDraft', () => {
  it('accepts a complete draft', () => {
    expect(
      validateSolanaTokenDraft({
        name: 'Proto Cat',
        symbol: 'PCAT',
        description: 'A cat on Solana',
        image: 'ipfs://bafy',
        website: 'https://proto.family',
      }),
    ).toEqual([]);
  });

  it('reports missing, oversized and malformed fields', () => {
    const problems = validateSolanaTokenDraft({
      name: 'x'.repeat(33),
      symbol: 'TOO-LONG-TICKER',
      image: 'javascript:alert(1)',
    });
    expect(problems).toHaveLength(3);
    expect(validateSolanaTokenDraft({ name: ' ', symbol: '' })).toEqual([
      'Token name is required',
      'Ticker is required',
    ]);
    expect(validateSolanaTokenDraft({ name: 'Ok', symbol: 'A$B' })).toEqual([
      'Ticker may only contain letters and numbers',
    ]);
  });
});
