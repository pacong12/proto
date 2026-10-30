import { UNDEPLOYED } from '@goton/shared-types';
import { assertAddress } from '../../../../core/errors/app-error';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';

export interface DevActivity {
  creatorAddress: string;
  initialBuyEth: string;
  currentHoldPercent: number;
  creatorStatus: 'holding' | 'sold' | 'none';
  totalDevSoldEth: string;
  hasRenounced: boolean;
}

/** Above this share of supply the creator still counts as holding. */
const HOLDING_PERCENT = 0.5;

export class GetDevActivityUseCase {
  constructor(private readonly tokenRepository: TokenRepositoryPort) {}

  /** What the creator did with the token: how much they hold and how much quote they sold for. */
  async execute(address: string): Promise<DevActivity> {
    assertAddress(address);
    const token = await this.tokenRepository.findByAddress(address);
    const devAddr = token?.deployer || UNDEPLOYED;
    const dev = devAddr.toLowerCase();
    const [trades, holders] = await Promise.all([
      this.tokenRepository.getTrades(address, 500, 0),
      this.tokenRepository.getHolders(address, 100),
    ]);

    const devSoldEth = trades
      .filter((t) => t.trader.toLowerCase() === dev && !t.isBuy)
      .reduce((sum, t) => sum + parseFloat(t.wethAmount || '0'), 0);
    const holdPercent = holders.find((h) => h.address.toLowerCase() === dev)?.percent ?? 0;

    return {
      creatorAddress: devAddr,
      initialBuyEth: token?.initialBuyAmount || '0.00',
      currentHoldPercent: holdPercent,
      creatorStatus: holdPercent > HOLDING_PERCENT ? 'holding' : devSoldEth > 0 ? 'sold' : 'none',
      totalDevSoldEth: devSoldEth.toFixed(4),
      hasRenounced: false,
    };
  }
}
