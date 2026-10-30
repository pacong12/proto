import {
  CHAINS,
  DEFAULT_NETWORK,
  type NetworkConfig,
  type TokenAddressPair,
  resolveTokenNetwork,
  resolveNetworkByParam,
} from '@goton/shared-types';
import type { PublicClient } from 'viem';
import type { ChainRegistryPort, IChainService } from '../domain/chain.port';
import type { PriceFeedPort } from '../../tokens/domain/ports/price-feed.port';
import { ChainService } from './chain.service';
import { createChainClient } from '../../../core/rpc';

/** One ChainService per network in the shared chain registry (CHAINS). */
export class ChainRegistry implements ChainRegistryPort {
  private readonly services = new Map<number, IChainService>();

  constructor(
    priceFeed: PriceFeedPort,
    createClient: (network: NetworkConfig) => PublicClient = createChainClient,
    networks: readonly NetworkConfig[] = CHAINS,
  ) {
    for (const network of networks) {
      this.services.set(
        network.chainId,
        new ChainService(createClient(network), network, priceFeed),
      );
    }
  }

  getAllChains(): IChainService[] {
    return Array.from(this.services.values());
  }

  /** The chain with this ID, or the default network's chain. */
  getChainById(chainId?: number): IChainService {
    return (
      (chainId !== undefined ? this.services.get(chainId) : undefined) ??
      this.services.get(DEFAULT_NETWORK.chainId)!
    );
  }

  getChainByParam(param?: string | null): IChainService {
    return this.getChainById(resolveNetworkByParam(param).chainId);
  }

  resolveForToken(token?: TokenAddressPair | null, activeChainId?: number): IChainService {
    return this.getChainById(resolveTokenNetwork(token, activeChainId).chainId);
  }
}
