import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOLANA_MAX_TRANSACTION_BYTES } from '../src/chains/solana/solana-token.service';
import { estimateSolanaLaunchCostLamports } from '../src/chains/solana/solana-cost';

/**
 * The launch transaction is executed against the real SPL Token-2022 program on LiteSVM
 * in a separate Bun process (see test/solana/launch-scenarios.ts for why).
 */
function runScenarios() {
  const script = path.resolve(__dirname, 'solana/launch-scenarios.ts');
  const run = spawnSync('bun', [script], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (run.status !== 0) {
    throw new Error(`launch scenarios failed (exit ${run.status}):\n${run.stderr}`);
  }
  return JSON.parse(run.stdout);
}

describe('Solana token launch transaction (executed on LiteSVM)', () => {
  const report = runScenarios();

  it('creates a fixed-supply Token-2022 mint with on-chain metadata', () => {
    const r = report.standard;
    expect(r.failure).toBeNull();
    expect(r.supply).toBe((1_000_000_000n * 10n ** 9n).toString());
    expect(r.decimals).toBe(9);
    expect(r.metadata).toEqual({
      name: 'Proto Cat',
      symbol: 'PCAT',
      uri: 'https://gateway.pinata.cloud/ipfs/bafybeigdyrztmetadata',
      updateAuthorityIsCreator: true,
    });
    expect(r.pointerTargetsMint).toBe(true);
    expect(r.pointerAuthority).toBeNull();
  });

  it('gives the creator the full supply and locks it permanently', () => {
    const r = report.standard;
    expect(r.holderIsCreator).toBe(true);
    expect(r.holderAmount).toBe(r.rawSupply);
    expect(r.mintAuthority).toBeNull();
    expect(r.freezeAuthority).toBeNull();
    expect(r.extraMintRejected).toBe(true);
  });

  it('fits max-length metadata in one transaction and costs no more than estimated', () => {
    const r = report.maxLength;
    expect(r.failure).toBeNull();
    expect(r.transactionBytes).toBeLessThanOrEqual(SOLANA_MAX_TRANSACTION_BYTES);
    expect(r.spentLamports).toBeGreaterThan(r.rentLamports);
    expect(r.spentLamports).toBeLessThanOrEqual(r.estimatedTotalLamports);
  });

  it('keeps the lightweight UI cost estimate in line with the real rent', () => {
    const r = report.maxLength;
    const estimate = estimateSolanaLaunchCostLamports('N'.repeat(32), 'S'.repeat(10), 200);
    expect(estimate).toBeGreaterThanOrEqual(r.spentLamports);
    expect(estimate).toBeLessThan(r.spentLamports * 1.02);
  });

  it('is rejected when the creator cannot pay for it', () => {
    expect(report.unfunded.rejected).toBe(true);
  });
});
