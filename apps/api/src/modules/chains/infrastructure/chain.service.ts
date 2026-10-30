import type { NetworkConfig } from '@goton/shared-types';
import type { PublicClient } from 'viem';
import type { IChainService } from '../domain/chain.port';
import type { PriceFeedPort } from '../../tokens/domain/ports/price-feed.port';

/** A network's chain backed by its viem client and the price feed. */
export class ChainService implements IChainService {
  readonly chainId: number;
  readonly name: string;
  readonly quoteSymbol: string;
  readonly quoteDecimals: number;

  constructor(
    readonly client: PublicClient,
    readonly network: NetworkConfig,
    private readonly priceFeed: PriceFeedPort,
  ) {
    this.chainId = network.chainId;
    this.name = network.name;
    this.quoteSymbol = network.nativeCurrency.symbol;
    this.quoteDecimals = network.nativeCurrency.decimals;
  }

  async getQuotePriceUsd(): Promise<number> {
    return this.priceFeed.getQuoteAssetPriceUsd(this.chainId);
  }
}
