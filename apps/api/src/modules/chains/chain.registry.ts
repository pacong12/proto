import {
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  type TokenAddressPair,
  resolveTokenNetwork,
  resolveNetworkByParam,
} from '@proto/shared-types';
import type { PublicClient } from 'viem';
import type { IChainService } from './chain.interface';
import type { PriceFeedPort } from '../tokens/domain/ports/price-feed.port';
import { RobinhoodChainService } from './robinhood/robinhood.chain-service';
import { ArcChainService } from './arc/arc.chain-service';

export { GenericChainService } from './generic-chain.service';
export { RobinhoodChainService } from './robinhood/robinhood.chain-service';
export { ArcChainService } from './arc/arc.chain-service';

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
