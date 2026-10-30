import { resolveTokenNetwork, type LaunchedTokenEntity } from '@goton/shared-types';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { findAllTokens } from '../../application/all-tokens';

export interface SourceVerifyResult {
  chainId: number;
  address: string;
  status: 'verified' | 'submitted' | 'failed';
  reason?: string;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** A submitted job is confirmed by the lookup after this delay; each further try waits twice as long. */
const FIRST_RETRY_MS = 5 * 60_000;
const MAX_RETRY_MS = 6 * 60 * 60_000;

/**
 * Publishes the source of every launched token and curve on Sourcify, which the Blockscout
 * explorers of Robinhood Chain and Arc import. A factory creates every token (and curve) with the
 * same bytecode, so Sourcify's similarity search verifies a new launch from one already verified
 * contract: no source files or API key here. The first launch of a new factory has nothing to
 * match and is verified once by hand (contracts/scripts/verify-sourcify.sh); until then its
 * contracts are retried with a growing delay. Verified contracts are remembered for the process.
 */
export class SourceVerifyKeeperService {
  private readonly verified = new Set<string>();
  private readonly retries = new Map<string, { at: number; delayMs: number }>();

  constructor(
    private readonly repository: Pick<TokenRepositoryPort, 'findAll'>,
    private readonly fetchFn: Fetch = fetch,
    private readonly baseUrl = 'https://sourcify.dev/server',
    private readonly maxSubmissions = 10,
    private readonly now: () => number = Date.now,
  ) {}

  private contractsOf(token: LaunchedTokenEntity): Array<{ chainId: number; address: string }> {
    const { chainId } = resolveTokenNetwork(token, token.chainId);
    const addresses = [token.address];
    if (token.version === 'v2' && token.curveAddress && token.curveAddress !== token.address) {
      addresses.push(token.curveAddress);
    }
    return addresses.map((address) => ({ chainId, address }));
  }

  async runOnce(): Promise<SourceVerifyResult[]> {
    const results: SourceVerifyResult[] = [];
    let submitted = 0;
    for (const token of await findAllTokens(this.repository)) {
      for (const { chainId, address } of this.contractsOf(token)) {
        const key = `${chainId}:${address.toLowerCase()}`;
        if (this.verified.has(key)) continue;
        const retry = this.retries.get(key);
        if (retry && retry.at > this.now()) continue;
        if (submitted >= this.maxSubmissions) return results;

        const result = await this.verify(chainId, address);
        results.push(result);
        if (result.status === 'verified') {
          this.verified.add(key);
          this.retries.delete(key);
          continue;
        }
        submitted += 1;
        const delayMs = retry ? Math.min(retry.delayMs * 2, MAX_RETRY_MS) : FIRST_RETRY_MS;
        this.retries.set(key, { at: this.now() + delayMs, delayMs });
      }
    }
    return results;
  }

  private async verify(chainId: number, address: string): Promise<SourceVerifyResult> {
    try {
      const lookup = await this.fetchFn(`${this.baseUrl}/v2/contract/${chainId}/${address}`);
      if (lookup.ok) return { chainId, address, status: 'verified' };
      if (lookup.status !== 404) {
        return { chainId, address, status: 'failed', reason: `lookup HTTP ${lookup.status}` };
      }

      const res = await this.fetchFn(`${this.baseUrl}/v2/verify/similarity/${chainId}/${address}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (res.status === 202) return { chainId, address, status: 'submitted' };
      const body = (await res.json().catch(() => ({}))) as {
        customCode?: string;
        message?: string;
      };
      if (body.customCode === 'already_verified') return { chainId, address, status: 'verified' };
      return {
        chainId,
        address,
        status: 'failed',
        reason: body.customCode ?? body.message ?? `HTTP ${res.status}`,
      };
    } catch (e) {
      return { chainId, address, status: 'failed', reason: (e as Error).message };
    }
  }
}
