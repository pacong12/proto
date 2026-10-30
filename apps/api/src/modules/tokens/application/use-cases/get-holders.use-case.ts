import { assertAddress } from '../../../../core/errors/app-error';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';

export class GetHoldersUseCase {
  constructor(private readonly tokenRepository: TokenRepositoryPort) {}

  /** The token's largest holders with their share of supply. */
  execute(
    address: string,
    limit = 50,
  ): Promise<Array<{ address: string; balance: string; percent: number }>> {
    assertAddress(address);
    return this.tokenRepository.getHolders(address, limit);
  }
}
