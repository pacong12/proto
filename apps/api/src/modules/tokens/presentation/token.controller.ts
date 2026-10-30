import { ApiEnvelope, ok, err } from '@goton/shared-types';
import {
  GetTokensUseCase,
  TokenWithMarketData,
} from '../application/use-cases/get-tokens.use-case';
import {
  GetTokenByAddressUseCase,
  TokenDetailResult,
} from '../application/use-cases/get-token-by-address.use-case';
import { TokenRepositoryPort } from '../domain/ports/token.repository.port';

export class TokenController {
  constructor(
    private readonly getTokensUseCase: GetTokensUseCase,
    private readonly getTokenByAddressUseCase: GetTokenByAddressUseCase,
    private readonly tokenRepository: TokenRepositoryPort,
  ) {}

  async listTokens(
    limit = 50,
    offset = 0,
    version?: 'v1' | 'v2',
    deployer?: string,
  ): Promise<ApiEnvelope<TokenWithMarketData[]>> {
    try {
      // Filters are pushed into SQL via getTokensUseCase.execute so LIMIT/OFFSET applies
      // after filtering, not before. JS post-filter was breaking pagination correctness.
      const result = await this.getTokensUseCase.execute(limit, offset, {
        version,
        deployer,
      });
      return ok(result);
    } catch (error) {
      return err('FETCH_TOKENS_FAILED', (error as Error).message);
    }
  }

  async getToken(address: string): Promise<ApiEnvelope<TokenDetailResult>> {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const result = await this.getTokenByAddressUseCase.execute(address as `0x${string}`);
      if (!result) {
        return err('TOKEN_NOT_FOUND', `No token found for address ${address}`);
      }
      return ok(result);
    } catch (error) {
      return err('FETCH_TOKEN_FAILED', (error as Error).message);
    }
  }

  async getHolders(
    address: string,
    limit = 50,
  ): Promise<ApiEnvelope<Array<{ address: string; balance: string; percent: number }>>> {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const holders = await this.tokenRepository.getHolders(address, limit);
      return ok(holders);
    } catch (error) {
      return err('FETCH_HOLDERS_FAILED', (error as Error).message);
    }
  }
  async getDevActivity(address: string): Promise<
    ApiEnvelope<{
      creatorAddress: string;
      initialBuyEth: string;
      currentHoldPercent: number;
      creatorStatus: 'holding' | 'sold' | 'none';
      totalDevSoldEth: string;
      hasRenounced: boolean;
    }>
  > {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const token = await this.tokenRepository.findByAddress(address as `0x${string}`);
      const devAddr = token?.deployer || '0x0000000000000000000000000000000000000000';
      const trades = await this.tokenRepository.getTrades(address as `0x${string}`, 500, 0);

      let devSoldEth = 0;
      for (const t of trades) {
        if (t.trader.toLowerCase() === devAddr.toLowerCase() && !t.isBuy) {
          devSoldEth += parseFloat(t.wethAmount || '0');
        }
      }

      const holders = await this.tokenRepository.getHolders(address, 100);
      const devHolder = holders.find((h) => h.address.toLowerCase() === devAddr.toLowerCase());
      const holdPercent = devHolder ? devHolder.percent : 0;

      let creatorStatus: 'holding' | 'sold' | 'none' = 'none';
      if (holdPercent > 0.5) {
        creatorStatus = 'holding';
      } else if (devSoldEth > 0) {
        creatorStatus = 'sold';
      }

      return ok({
        creatorAddress: devAddr,
        initialBuyEth: token?.initialBuyAmount || '0.00',
        currentHoldPercent: holdPercent,
        creatorStatus,
        totalDevSoldEth: devSoldEth.toFixed(4),
        hasRenounced: false,
      });
    } catch (error) {
      return err('FETCH_DEV_ACTIVITY_FAILED', (error as Error).message);
    }
  }
}
