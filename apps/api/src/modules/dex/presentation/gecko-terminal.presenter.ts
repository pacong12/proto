import type {
  CandlestickEntity,
  LaunchedTokenEntity,
  NetworkConfig,
  TokenMarketData,
  TradeEventEntity,
} from '@goton/shared-types';
import type { GeckoPool } from '../application/gecko-terminal.service';

/** Response builders for the GeckoTerminal-style endpoints under /api/v1/networks. */

/** `<chainId>_<address>`: how GeckoTerminal ids a token or pool. */
const geckoId = (network: NetworkConfig, address: string) => `${network.chainId}_${address}`;

export function poolResponse(network: NetworkConfig, pool: GeckoPool) {
  const { token, marketData: mkt, latestTrade, quotePriceUsd } = pool;
  const priceUsdValue = latestTrade?.priceUsd ?? mkt?.priceUsd ?? 0;
  const tokenAmt = parseFloat(latestTrade?.tokenAmount ?? '0');
  const wethAmt = parseFloat(latestTrade?.wethAmount ?? '0');
  const priceNative = tokenAmt > 0 ? (wethAmt / tokenAmt).toFixed(18) : '0';
  return {
    data: {
      id: geckoId(network, token.poolAddress),
      type: 'pool',
      attributes: {
        base_token_price_usd: priceUsdValue.toFixed(12),
        quote_token_price_usd: quotePriceUsd.toFixed(2),
        base_token_price_native_currency: priceNative,
        address: token.poolAddress,
        name: `${token.symbol} / ${network.nativeCurrency.symbol}`,
        pool_created_at: new Date(token.createdAt).toISOString(),
        token_price_usd: priceUsdValue.toFixed(12),
        fdv_usd: mkt?.fdvUsd ? mkt.fdvUsd.toFixed(2) : null,
        market_cap_usd: mkt?.marketCapUsd ? mkt.marketCapUsd.toFixed(2) : null,
        price_change_h1: null,
        price_change_h24: null,
        transactions_h24_buys: pool.buys24h,
        transactions_h24_sells: pool.sells24h,
        volume_usd: { h24: (pool.volume24hQuote * quotePriceUsd).toFixed(2) },
        reserve_in_usd: mkt?.pairedPrincipalWeth
          ? (parseFloat(mkt.pairedPrincipalWeth) * quotePriceUsd).toFixed(2)
          : null,
      },
      relationships: {
        base_token: { data: { id: geckoId(network, token.address), type: 'token' } },
        quote_token: { data: { id: geckoId(network, network.contracts.weth), type: 'token' } },
        dex: { data: { id: 'proto', type: 'dex' } },
      },
    },
  };
}

export function tokenResponse(
  network: NetworkConfig,
  t: LaunchedTokenEntity,
  m: TokenMarketData | undefined,
  quotePriceUsd: number,
) {
  return {
    data: {
      id: geckoId(network, t.address),
      type: 'token',
      attributes: {
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        decimals: t.decimals,
        image_url: t.logo || null,
        coingecko_coin_id: null,
        total_supply: t.totalSupply,
        price_usd: m?.priceUsd ? m.priceUsd.toString() : null,
        fdv_usd: m?.fdvUsd ? m.fdvUsd.toFixed(2) : null,
        total_reserve_in_usd: m?.pairedPrincipalWeth
          ? (parseFloat(m.pairedPrincipalWeth) * quotePriceUsd).toFixed(2)
          : null,
        volume_usd: { h24: m?.volume24hUsd ? m.volume24hUsd.toFixed(2) : null },
        market_cap_usd: m?.marketCapUsd ? m.marketCapUsd.toFixed(2) : null,
      },
    },
  };
}

export function ohlcvResponse(
  network: NetworkConfig,
  token: LaunchedTokenEntity,
  timeframe: string,
  candles: CandlestickEntity[],
) {
  return {
    data: {
      id: `${geckoId(network, token.poolAddress)}_${timeframe}`,
      type: 'ohlcv',
      attributes: {
        ohlcv_list: candles.map((c) => [c.timestamp, c.open, c.high, c.low, c.close, c.volume]),
      },
    },
    meta: { base: token.symbol, quote: network.nativeCurrency.symbol },
  };
}

export function tradesResponse(
  network: NetworkConfig,
  token: LaunchedTokenEntity,
  trades: TradeEventEntity[],
  quotePriceUsd: number,
) {
  const quoteId = geckoId(network, network.contracts.weth);
  const tokenId = geckoId(network, token.address);
  const quoteUsd = quotePriceUsd.toFixed(2);
  return {
    data: trades.map((tr) => {
      const tokenUsd = tr.priceUsd.toFixed(8);
      return {
        id: tr.transactionHash,
        type: 'trade',
        attributes: {
          block_number: Number(tr.blockNumber),
          tx_hash: tr.transactionHash,
          tx_from_address: tr.trader,
          from_token_amount: tr.isBuy ? tr.wethAmount : tr.tokenAmount,
          to_token_amount: tr.isBuy ? tr.tokenAmount : tr.wethAmount,
          price_from_in_currency_usd: tr.isBuy ? quoteUsd : tokenUsd,
          price_to_in_currency_usd: tr.isBuy ? tokenUsd : quoteUsd,
          price_from_in_usd: tr.isBuy ? quoteUsd : tokenUsd,
          price_to_in_usd: tr.isBuy ? tokenUsd : quoteUsd,
          kind: tr.isBuy ? 'buy' : 'sell',
          volume_in_usd: (parseFloat(tr.wethAmount) * quotePriceUsd).toFixed(2),
          block_timestamp: new Date(tr.timestamp ?? 0).toISOString(),
        },
        relationships: {
          from_token: { data: { id: tr.isBuy ? quoteId : tokenId, type: 'token' } },
          to_token: { data: { id: tr.isBuy ? tokenId : quoteId, type: 'token' } },
        },
      };
    }),
  };
}
