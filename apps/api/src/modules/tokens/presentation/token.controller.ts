import type { ApiEnvelope } from '@goton/shared-types';
import {
  GetTokensUseCase,
  TokenWithMarketData,
} from '../application/use-cases/get-tokens.use-case';
import {
  GetTokenByAddressUseCase,
  TokenDetailResult,
} from '../application/use-cases/get-token-by-address.use-case';
import { GetHoldersUseCase } from '../application/use-cases/get-holders.use-case';
import {
  GetDevActivityUseCase,
  type DevActivity,
} from '../application/use-cases/get-dev-activity.use-case';
import { assertAddress, NotFoundError } from '../../../core/errors/app-error';
import { toEnvelope } from '../../../core/http/api-envelope';

export class TokenController {
  constructor(
    private readonly getTokensUseCase: GetTokensUseCase,
    private readonly getTokenByAddressUseCase: GetTokenByAddressUseCase,
    private readonly getHoldersUseCase: GetHoldersUseCase,
    private readonly getDevActivityUseCase: GetDevActivityUseCase,
  ) {}

  listTokens(
    limit = 50,
    offset = 0,
    version?: 'v1' | 'v2',
    deployer?: string,
  ): Promise<ApiEnvelope<TokenWithMarketData[]>> {
    // Filters are pushed into SQL so LIMIT/OFFSET applies after filtering, not before.
    return toEnvelope('FETCH_TOKENS_FAILED', () =>
      this.getTokensUseCase.execute(limit, offset, { version, deployer }),
    );
  }

  getToken(address: string): Promise<ApiEnvelope<TokenDetailResult>> {
    return toEnvelope('FETCH_TOKEN_FAILED', async () => {
      assertAddress(address);
      const result = await this.getTokenByAddressUseCase.execute(address);
      if (!result)
        throw new NotFoundError(`No token found for address ${address}`, 'TOKEN_NOT_FOUND');
      return result;
    });
  }

  getHolders(
    address: string,
    limit = 50,
  ): Promise<ApiEnvelope<Array<{ address: string; balance: string; percent: number }>>> {
    return toEnvelope('FETCH_HOLDERS_FAILED', () => this.getHoldersUseCase.execute(address, limit));
  }

  getDevActivity(address: string): Promise<ApiEnvelope<DevActivity>> {
    return toEnvelope('FETCH_DEV_ACTIVITY_FAILED', () =>
      this.getDevActivityUseCase.execute(address),
    );
  }
}
