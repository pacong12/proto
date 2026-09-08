import { ApiEnvelope, TradeEventEntity, CandlestickEntity, ok, err } from '@proto/shared-types';
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
      let result = await this.getTokensUseCase.execute(limit, offset);
      if (version) {
        result = result.filter((t) => (t.token.version ?? 'v1') === version);
      }
      if (deployer) {
        const target = deployer.toLowerCase();
        result = result.filter((t) => t.token.deployer.toLowerCase() === target);
      }
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

  async getTrades(
    address: string,
    limit = 50,
    offset = 0,
  ): Promise<ApiEnvelope<TradeEventEntity[]>> {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const trades = await this.tokenRepository.getTrades(address as `0x${string}`, limit, offset);
      return ok(trades);
    } catch (error) {
      return err('FETCH_TRADES_FAILED', (error as Error).message);
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

  async getCandlesticks(
    address: string,
    resolutionSeconds = 60,
  ): Promise<ApiEnvelope<CandlestickEntity[]>> {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const candles = await this.tokenRepository.getCandlesticks(
        address as `0x${string}`,
        resolutionSeconds,
      );
      return ok(candles);
    } catch (error) {
      return err('FETCH_CANDLESTICKS_FAILED', (error as Error).message);
    }
  }
}
