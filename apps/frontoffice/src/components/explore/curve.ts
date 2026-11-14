import type { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';

/** A bonding-curve launch still filling its curve: the only kind with progress to show. */
export function hasCurve(item: {
  token: LaunchedTokenEntity;
  marketData?: TokenMarketData | null;
}): boolean {
  return item.token.version !== 'v4' && !item.marketData?.isGraduated && !item.token.isGraduated;
}
