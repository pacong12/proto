import {
  InMemoryTokenRepository,
  ViemChainIndexerAdapter,
  CalculatePricingUseCase,
  GetTokensUseCase,
  GetTokenByAddressUseCase,
  TokenController,
  SecurityGateService,
  SecurityController,
  EventPollerService,
} from './index';
import { publicClient } from '../../frontoffice/src/lib/viem-client';
import { TransactionIntent } from '@proto/shared-types';

const PORT = parseInt(process.env.PORT ?? process.env.API_PORT ?? '3001', 10);

const repository = new InMemoryTokenRepository();
const chainIndexer = new ViemChainIndexerAdapter();
const calculatePricing = new CalculatePricingUseCase();
const getTokensUseCase = new GetTokensUseCase(repository);
const getTokenByAddressUseCase = new GetTokenByAddressUseCase(
  repository,
  chainIndexer,
  calculatePricing,
);
const tokenController = new TokenController(getTokensUseCase, getTokenByAddressUseCase, repository);

const securityGateService = new SecurityGateService();
const securityController = new SecurityController(securityGateService);

const eventPoller = new EventPollerService(
  publicClient,
  repository,
  chainIndexer,
  calculatePricing,
);

// Start background event poller worker loop
setInterval(async () => {
  try {
    await eventPoller.pollEvents();
  } catch {
    // Ignore background polling network errors
  }
}, 10000);

export const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // Health check
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'proto-api', timestamp: Date.now() }),
        { headers },
      );
    }

    // GET /api/tokens
    if (url.pathname === '/api/tokens' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
      const res = await tokenController.listTokens(limit, offset);
      return new Response(JSON.stringify(res), { headers });
    }

    // GET /api/tokens/:address/trades
    const tradesMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/trades$/);
    if (tradesMatch && req.method === 'GET') {
      const address = tradesMatch[1];
      const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      const res = await tokenController.getTrades(address, limit);
      return new Response(JSON.stringify(res), { headers });
    }

    // GET /api/tokens/:address/ohlcv
    const ohlcvMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/ohlcv$/);
    if (ohlcvMatch && req.method === 'GET') {
      const address = ohlcvMatch[1];
      const resolution = parseInt(url.searchParams.get('resolution') ?? '60', 10);
      const res = await tokenController.getCandlesticks(address, resolution);
      return new Response(JSON.stringify(res), { headers });
    }

    // GET /api/tokens/:address
    const tokenMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})$/);
    if (tokenMatch && req.method === 'GET') {
      const address = tokenMatch[1];
      const res = await tokenController.getToken(address);
      return new Response(JSON.stringify(res), { headers });
    }

    // POST /api/security/evaluate
    if (url.pathname === '/api/security/evaluate' && req.method === 'POST') {
      try {
        const body = (await req.json()) as TransactionIntent;
        const res = securityController.evaluateIntent(body);
        return new Response(JSON.stringify(res), { headers });
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            data: null,
            error: { code: 'BAD_REQUEST', message: 'Malformed JSON payload' },
            timestamp: Date.now(),
          }),
          { status: 400, headers },
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: `Route ${url.pathname} not found` },
        timestamp: Date.now(),
      }),
      { status: 404, headers },
    );
  },
});

console.info(`Proto API Server & Indexer running at http://localhost:${PORT}`);
