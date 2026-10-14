import {
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  type TokenAddressPair,
  type NetworkConfig,
  resolveTokenNetwork,
  resolveNetworkByParam,
} from '@proto/shared-types';
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

export class RobinhoodChainService extends GenericChainService {
  constructor(client: PublicClient, priceFeed: PriceFeedPort) {
    super(client, ROBINHOOD_CHAIN, priceFeed);
  }
}

export class ArcChainService extends GenericChainService {
  constructor(client: PublicClient, priceFeed: PriceFeedPort) {
    super(client, ARC_CHAIN, priceFeed);
  }
}

export class ChainRegistry {
  private readonly services = new Map<number, IChainService>();

  constructor(robinhoodClient: PublicClient, arcClient: PublicClient, priceFeed: PriceFeedPort) {
    this.registerChain(new RobinhoodChainService(robinhoodClient, priceFeed));
    this.registerChain(new ArcChainService(arcClient, priceFeed));
  }

  registerChain(service: IChainService): void {
    this.services.set(service.chainId, service);
  }

  getAllChains(): IChainService[] {
    return Array.from(this.services.values());
  }

  getRobinhoodChain(): IChainService {
    return this.services.get(ROBINHOOD_CHAIN.chainId)!;
  }

  getArcChain(): IChainService {
    return this.services.get(ARC_CHAIN.chainId)!;
  }

  getChainById(chainId?: number): IChainService {
    if (chainId && this.services.has(chainId)) {
      return this.services.get(chainId)!;
    }
    return this.getRobinhoodChain();
  }

  getChainByParam(param?: string | null): IChainService {
    const net = resolveNetworkByParam(param);
    return this.getChainById(net.chainId);
  }

  resolveForToken(token?: TokenAddressPair | null, activeChainId?: number): IChainService {
    const net = resolveTokenNetwork(token, activeChainId);
    return this.getChainById(net.chainId);
  }
}
