import { ARC_CHAIN, type NetworkConfig } from '@goton/shared-types';
import type { PublicClient } from 'viem';
import type { IChainService } from './chain.interface';
import type { PriceFeedPort } from '../tokens/domain/ports/price-feed.port';

export class GenericChainService implements IChainService {
  readonly chainId: number;
  readonly name: string;
  readonly network: NetworkConfig;
  readonly quoteSymbol: string;
  readonly quoteDecimals: number;

  constructor(
    readonly client: PublicClient,
    readonly networkConfig: NetworkConfig,
    private readonly priceFeed: PriceFeedPort,
  ) {
    this.chainId = networkConfig.chainId;
    this.name = networkConfig.name;
    this.network = networkConfig;
    this.quoteSymbol = networkConfig.nativeCurrency.symbol;
    this.quoteDecimals = networkConfig.nativeCurrency.decimals;
  }

  get isArc(): boolean {
    return this.chainId === ARC_CHAIN.chainId;
  }

  async getQuotePriceUsd(): Promise<number> {
    return this.priceFeed.getQuoteAssetPriceUsd(this.chainId);
  }
}
