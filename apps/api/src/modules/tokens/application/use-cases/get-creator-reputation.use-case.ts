import type { Address } from 'viem';
import { assertAddress } from '../../../../core/errors/app-error';
import type { TokenRepositoryPort } from '../../../../core/ports/token.repository.port';
import { findAllTokens } from '../all-tokens';

/** A creator's launch track record: a trust signal shown on their profile and token pages. */
export interface CreatorReputation {
  creatorAddress: string;
  /** Tokens this wallet has launched. */
  launches: number;
  /** How many reached their Uniswap pool (graduated). */
  graduated: number;
  /** Still trading on their bonding curve (not graduated). */
  active: number;
  /** graduated / launches, 0..1 (0 when they have never launched). */
  graduationRate: number;
  /** Current market cap summed across every token they launched (USD). */
  totalMarketCapUsd: number;
  /** Their biggest token by current market cap, or null when they have none. */
  topToken: { address: string; name: string; symbol: string; marketCapUsd: number } | null;
}

/** Most tokens a creator's reputation reads, so one prolific wallet cannot stall the request. */
export const CREATOR_REPUTATION_MAX_TOKENS = 1000;

export class GetCreatorReputationUseCase {
  constructor(private readonly tokenRepository: TokenRepositoryPort) {}

  async execute(creator: string): Promise<CreatorReputation> {
    assertAddress(creator);
    const tokens = (await findAllTokens(this.tokenRepository, { deployer: creator })).slice(
      0,
      CREATOR_REPUTATION_MAX_TOKENS,
    );

    let graduated = 0;
    let totalMarketCapUsd = 0;
    let topToken: CreatorReputation['topToken'] = null;

    for (const token of tokens) {
      const market = await this.tokenRepository.getMarketData(token.address as Address);
      // isGraduated is the token flag; graduationProgress >= 1 covers tokens whose flag lags.
      if (token.isGraduated || (market?.graduationProgress ?? 0) >= 1) graduated++;

      const marketCapUsd = market?.marketCapUsd ?? 0;
      totalMarketCapUsd += marketCapUsd;
      if (!topToken || marketCapUsd > topToken.marketCapUsd) {
        topToken = { address: token.address, name: token.name, symbol: token.symbol, marketCapUsd };
      }
    }

    const launches = tokens.length;
    return {
      creatorAddress: creator.toLowerCase(),
      launches,
      graduated,
      active: launches - graduated,
      graduationRate: launches > 0 ? graduated / launches : 0,
      totalMarketCapUsd,
      topToken: launches > 0 ? topToken : null,
    };
  }
}
