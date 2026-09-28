import {
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  type TokenAddressPair,
  isArcToken,
  resolveNetworkByParam,
} from '@proto/shared-types';
import type { PublicClient } from 'viem';
import type { IChainService } from './chain.interface';
import type { PriceFeedPort } from '../tokens/domain/ports/price-feed.port';

export class RobinhoodChainService implements IChainService {
  readonly chainId = ROBINHOOD_CHAIN.chainId;
  readonly name = ROBINHOOD_CHAIN.name;
  readonly network = ROBINHOOD_CHAIN;
  readonly isArc = false;

  constructor(
    readonly client: PublicClient,
    private readonly priceFeed: PriceFeedPort,
  ) {}

  async getQuotePriceUsd(): Promise<number> {
    return this.priceFeed.getEthPriceUsd();
  }
}

export class ArcChainService implements IChainService {
  readonly chainId = ARC_CHAIN.chainId;
  readonly name = ARC_CHAIN.name;
  readonly network = ARC_CHAIN;
  readonly isArc = true;

  constructor(
    readonly client: PublicClient,
    private readonly priceFeed: PriceFeedPort,
  ) {}

  async getQuotePriceUsd(): Promise<number> {
    return this.priceFeed.getQuoteAssetPriceUsd(ARC_CHAIN.chainId);
  }
}

export class ChainRegistry {
  private readonly robinhood: RobinhoodChainService;
  private readonly arc: ArcChainService;

  constructor(robinhoodClient: PublicClient, arcClient: PublicClient, priceFeed: PriceFeedPort) {
    this.robinhood = new RobinhoodChainService(robinhoodClient, priceFeed);
    this.arc = new ArcChainService(arcClient, priceFeed);
  }

  getRobinhoodChain(): RobinhoodChainService {
    return this.robinhood;
  }

  getArcChain(): ArcChainService {
    return this.arc;
  }

  getChainById(chainId?: number): IChainService {
    if (chainId === ARC_CHAIN.chainId) {
      return this.arc;
    }
    return this.robinhood;
  }

  getChainByParam(param?: string | null): IChainService {
    const net = resolveNetworkByParam(param);
    return this.getChainById(net.chainId);
  }

  resolveForToken(token?: TokenAddressPair | null, activeChainId?: number): IChainService {
    if (isArcToken(token, activeChainId)) {
      return this.arc;
    }
    return this.robinhood;
  }
}
