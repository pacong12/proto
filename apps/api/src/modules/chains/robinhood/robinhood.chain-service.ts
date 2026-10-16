import { ROBINHOOD_CHAIN } from '@goton/shared-types';
import type { PublicClient } from 'viem';
import { GenericChainService } from '../generic-chain.service';
import type { PriceFeedPort } from '../../tokens/domain/ports/price-feed.port';

/**
 * Robinhood Chain Service (Chain ID: 4663)
 * Arbitrum Nitro L2 with native ETH gas asset.
 */
export class RobinhoodChainService extends GenericChainService {
  constructor(client: PublicClient, priceFeed: PriceFeedPort) {
    super(client, ROBINHOOD_CHAIN, priceFeed);
  }
}
