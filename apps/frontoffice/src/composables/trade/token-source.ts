import {
  CHAINS,
  FALLBACK_ETH_PRICE_USD,
  findFactoryLaunch,
  readV2LaunchedToken,
  stableQuoteUsd,
  type LaunchedTokenEntity,
  type NetworkConfig,
  type TokenMarketData,
} from '@goton/shared-types';
import { calculateCurveMarketData } from '@goton/math-sdk';
import { apiFetch } from '@/lib/api-client';
import { getPublicClient } from '@/lib/viem-client';

export interface TradeTokenData {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData;
}

/** Market data of a token still on its bonding curve, priced from the curve's reserves. */
function curveMarketData(token: LaunchedTokenEntity, network: NetworkConfig): TokenMarketData {
  return calculateCurveMarketData({
    address: token.address,
    virtualEthReserve: BigInt(token.virtualEthReserve ?? 0),
    virtualTokenReserve: BigInt(token.virtualTokenReserve ?? 0),
    totalEthRaised: BigInt(token.initialBuyAmount ?? 0),
    graduationTarget: BigInt(token.graduationTarget ?? 0),
    totalSupply: BigInt(token.totalSupply),
    tokenDecimals: token.decimals || 18,
    quotePriceUsd: stableQuoteUsd(network) ?? FALLBACK_ETH_PRICE_USD,
  });
}

/**
 * The token and its market data from the API; while the API does not know it yet (catching up,
 * or a 404), straight from its launch on chain. Null when no chain launched it.
 */
export async function fetchTradeToken(address: `0x${string}`): Promise<TradeTokenData | null> {
  try {
    const envelope = await apiFetch<{ success: boolean; data: TradeTokenData }>(
      `/api/tokens/${address}`,
    );
    if (envelope.success && envelope.data) return envelope.data;
  } catch {
    // non-blocking fallback
  }
  for (const network of CHAINS) {
    try {
      const client = getPublicClient(network.chainId);
      const launch = await findFactoryLaunch(client, network, address);
      if (!launch) continue;
      const token = await readV2LaunchedToken(
        client,
        network,
        address,
        launch.curve,
        Number(launch.createdAt) * 1000,
      );
      return { token, marketData: curveMarketData(token, network) };
    } catch {
      // try the next chain
    }
  }
  return null;
}
