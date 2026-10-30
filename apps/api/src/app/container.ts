import { ChainRegistry } from '../modules/chains';
import {
  SqliteTokenRepository,
  ViemChainIndexerAdapter,
  CalculatePricingUseCase,
  GetTokensUseCase,
  GetTokenByAddressUseCase,
  GetHoldersUseCase,
  GetDevActivityUseCase,
  TokenController,
  SecurityGateService,
  SecurityController,
  EventPollerService,
  IpfsService,
  IpfsController,
  CoinGeckoPriceFeedAdapter,
  logger,
  HttpRequestTracker,
  DevopsController,
  RedisCacheAdapter,
  InMemoryCacheAdapter,
} from '../index';
import { RateLimiter } from '../core';
import {
  GetTradesUseCase,
  GetRecentTradesUseCase,
  GetTopTradersUseCase,
  GetCandlesticksUseCase,
  TradeController,
} from '../modules/trades';
import { TradeSyncService } from '../modules/tokens/infrastructure/indexer/trade-sync.service';

/** Composition root: every service the routes and the background jobs share. */
const redisUrl = process.env.REDIS_URL || undefined;
const redisCache = new RedisCacheAdapter(redisUrl, logger);
// In-memory fallback for rate limiting when Redis is unavailable.
export const memoryCache = new InMemoryCacheAdapter();
// Unified cache: Redis when available, transparent in-memory when not.
export const cache = redisCache;

export const repository = new SqliteTokenRepository();
export const chainIndexer = new ViemChainIndexerAdapter();
export const priceFeed = new CoinGeckoPriceFeedAdapter({
  initialPrice: process.env.NODE_ENV === 'test' ? 2500 : undefined,
});
export const calculatePricing = new CalculatePricingUseCase();
export const getTokensUseCase = new GetTokensUseCase(
  repository,
  chainIndexer,
  priceFeed,
  calculatePricing,
);
export const getTokenByAddressUseCase = new GetTokenByAddressUseCase(
  repository,
  chainIndexer,
  calculatePricing,
  priceFeed,
  Date.now,
  (token) => tradeSync.scheduleBackfill(token),
);
export const tokenController = new TokenController(
  getTokensUseCase,
  getTokenByAddressUseCase,
  new GetHoldersUseCase(repository),
  new GetDevActivityUseCase(repository),
);

export const getTradesUseCase = new GetTradesUseCase(repository);
export const getRecentTradesUseCase = new GetRecentTradesUseCase(repository);
export const getTopTradersUseCase = new GetTopTradersUseCase(repository, repository, priceFeed);
export const getCandlesticksUseCase = new GetCandlesticksUseCase(repository);

export const tradeController = new TradeController(
  getTradesUseCase,
  getRecentTradesUseCase,
  getTopTradersUseCase,
  getCandlesticksUseCase,
);

export const securityGateService = new SecurityGateService();
export const securityController = new SecurityController(securityGateService);

export const ipfsService = new IpfsService();
export const ipfsController = new IpfsController(ipfsService);

export const chainRegistry = new ChainRegistry(priceFeed);

/** One event poller per supported chain, keyed by chain ID. */
export const pollers = new Map(
  chainRegistry
    .getAllChains()
    .map(
      (chain) =>
        [
          chain.chainId,
          new EventPollerService(
            chain.client,
            repository,
            chainIndexer,
            calculatePricing,
            priceFeed,
            chain.network,
          ),
        ] as const,
    ),
);

export const requestTracker = new HttpRequestTracker(logger, cache);
export const devopsController = new DevopsController(requestTracker);

// Rate limiting: namespaced by tier so crawler and API buckets do not collide.
export const rateLimiter = new RateLimiter(cache, memoryCache, logger);

/** Indexes trades the live pollers missed (late tokens, the app's own transactions). */
export const tradeSync = new TradeSyncService(repository, cache, chainRegistry, pollers, logger);

export type AppContainer = typeof import('./container');
