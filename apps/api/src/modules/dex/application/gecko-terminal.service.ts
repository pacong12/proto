import type {
  CandlestickEntity,
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
} from '@goton/shared-types';
import { NotFoundError } from '../../../core/errors/app-error';
import type { IChainService } from '../../chains';
import type { TokenStorePort } from '../../tokens/domain/ports/token-store.port';
import type { TradeStorePort } from '../../tokens/domain/ports/trade-store.port';
import type { GetTokenByAddressUseCase } from '../../tokens/application/use-cases/get-token-by-address.use-case';
import type { GetCandlesticksUseCase } from '../../trades/application/use-cases/get-candlesticks.use-case';

const DAY_MS = 86_400_000;

type GeckoStore = Pick<TokenStorePort, 'findByPoolAddress' | 'findAll' | 'getMarketData'> &
  Pick<TradeStorePort, 'getTrades' | 'getTradeFlow'>;

/** A pool as the GeckoTerminal endpoints describe it. */
export interface GeckoPool {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData | null;
  latestTrade: TradeEventEntity | undefined;
  quotePriceUsd: number;
  /** 24h volume in the quote asset. */
  volume24hQuote: number;
  buys24h: number;
  sells24h: number;
}

/** What the GeckoTerminal endpoints read: pools, tokens, candles and trades of one chain. */
export class GeckoTerminalService {
  constructor(
    private readonly repository: GeckoStore,
    private readonly getTokenByAddress: GetTokenByAddressUseCase,
    private readonly getCandlesticks: GetCandlesticksUseCase,
  ) {}

  async pool(chain: IChainService, poolAddress: `0x${string}`): Promise<GeckoPool> {
    const token = await this.findPoolToken(poolAddress);
    const quotePriceUsd = await chain.getQuotePriceUsd();
    const trades = await this.repository.getTrades(token.address, 500, 0);
    const marketData = await this.repository.getMarketData(token.address as `0x${string}`);
    const cutoff = Date.now() - DAY_MS;
    const recent = trades.filter((t) => (t.timestamp ?? 0) >= cutoff);
    let volume24hQuote = 0;
    if (this.repository.getTradeFlow) {
      // Summed in SQL: the newest 500 trades undercount an active pool's 24h volume.
      const flow = await this.repository.getTradeFlow(token.address as `0x${string}`, cutoff);
      volume24hQuote = flow.buyQuote + flow.sellQuote;
    } else {
      for (const trade of recent) volume24hQuote += parseFloat(trade.wethAmount);
    }
    return {
      token,
      marketData,
      latestTrade: trades[0],
      quotePriceUsd,
      volume24hQuote,
      buys24h: recent.filter((t) => t.isBuy).length,
      sells24h: recent.filter((t) => !t.isBuy).length,
    };
  }

  async token(
    chain: IChainService,
    address: `0x${string}`,
  ): Promise<{ token: LaunchedTokenEntity; marketData: TokenMarketData; quotePriceUsd: number }> {
    const detail = await this.getTokenByAddress.execute(address).catch(() => null);
    if (!detail) throw new NotFoundError('Token not found');
    return { ...detail, quotePriceUsd: await chain.getQuotePriceUsd() };
  }

  /** The newest `limit` candles of the pool's token, `resolutionSeconds` wide. */
  async ohlcv(
    poolAddress: `0x${string}`,
    resolutionSeconds: number,
    limit: number,
  ): Promise<{ token: LaunchedTokenEntity; candles: CandlestickEntity[] }> {
    const token = await this.findPoolToken(poolAddress);
    const candles = await this.getCandlesticks
      .execute(token.address, resolutionSeconds)
      .catch(() => [] as CandlestickEntity[]);
    return { token, candles: candles.slice(-limit) };
  }

  /** The pool's newest 100 trades and the quote asset's USD price. */
  async trades(
    chain: IChainService,
    poolAddress: `0x${string}`,
  ): Promise<{ token: LaunchedTokenEntity; trades: TradeEventEntity[]; quotePriceUsd: number }> {
    const token = await this.findPoolToken(poolAddress);
    const trades = await this.repository.getTrades(token.address, 100, 0);
    return { token, trades, quotePriceUsd: await chain.getQuotePriceUsd() };
  }

  private async findPoolToken(poolAddress: `0x${string}`): Promise<LaunchedTokenEntity> {
    // findByPoolAddress avoids loading all tokens to scan for a single pool address.
    const token = this.repository.findByPoolAddress
      ? await this.repository.findByPoolAddress(poolAddress)
      : ((await this.repository.findAll()).find(
          (t) => t.poolAddress.toLowerCase() === poolAddress,
        ) ?? null);
    if (!token) throw new NotFoundError('Pool not found');
    return token;
  }
}
