export interface RevenueSplit {
  creator: number;
  buyback: number;
  holders: number;
  growth: number;
}

export interface DonutSegment {
  key: keyof RevenueSplit;
  share: number;
  stroke: number;
  offset: number;
}

/**
 * Calculates total percentage of a revenue split allocation.
 */
export function calculateTotalSplit(split: RevenueSplit): number {
  return (
    Number(split.creator || 0) +
    Number(split.buyback || 0) +
    Number(split.holders || 0) +
    Number(split.growth || 0)
  );
}

/**
 * Calculates the maximum share available for a given key so the sum never exceeds 100%.
 */
export function calculateMaxShare(split: RevenueSplit, targetKey: keyof RevenueSplit): number {
  const allKeys: (keyof RevenueSplit)[] = ['creator', 'buyback', 'holders', 'growth'];
  const others = allKeys
    .filter((k) => k !== targetKey)
    .reduce((sum, k) => sum + Number(split[k] || 0), 0);
  return Math.max(0, 100 - others);
}

/**
 * Clamps a requested share percentage to prevent the split from exceeding 100%.
 */
export function clampShare(
  requested: number,
  split: RevenueSplit,
  targetKey: keyof RevenueSplit,
): number {
  const maxAllowed = calculateMaxShare(split, targetKey);
  const sanitized = Math.max(0, Math.round(Number(requested) || 0));
  return Math.min(sanitized, maxAllowed);
}

/**
 * Automatically adjusts a revenue split so that the sum equals exactly 100%.
 * Prefers adjusting holders, then creator, and defaults to 50/50 if out of bounds.
 */
export function autoBalanceSplit(split: RevenueSplit): RevenueSplit {
  const currentTotal = calculateTotalSplit(split);
  if (currentTotal === 100) return { ...split };

  const diff = 100 - currentTotal;
  const next = { ...split };

  if (next.holders + diff >= 0 && next.holders + diff <= 100) {
    next.holders += diff;
    return next;
  }
  if (next.creator + diff >= 0 && next.creator + diff <= 100) {
    next.creator += diff;
    return next;
  }

  // Fallback to safe 50/50 standard
  return { creator: 50, buyback: 0, holders: 50, growth: 0 };
}

/**
 * Dynamically adjusts a revenue split share, rebalancing remaining non-zero shares
 * so the total stays at exactly 100% and sliders never lock or freeze.
 */
export function adjustShareDynamically(
  split: RevenueSplit,
  targetKey: keyof RevenueSplit,
  requested: number,
): RevenueSplit {
  const targetVal = Math.max(0, Math.min(100, Math.round(Number(requested) || 0)));
  const currentVal = Math.max(0, Math.round(Number(split[targetKey]) || 0));
  const delta = targetVal - currentVal;

  if (delta === 0) return { ...split };

  const next = { ...split, [targetKey]: targetVal };
  const allKeys: (keyof RevenueSplit)[] = ['creator', 'holders', 'buyback', 'growth'];
  const otherKeys = allKeys.filter((k) => k !== targetKey);

  if (delta > 0) {
    let needed = delta;
    // Sort other keys by current value descending to deduct from the largest first
    const sortedOthers = [...otherKeys].sort((a, b) => next[b] - next[a]);
    for (const key of sortedOthers) {
      if (needed <= 0) break;
      const take = Math.min(next[key], needed);
      next[key] -= take;
      needed -= take;
    }
    if (needed > 0) {
      next[targetKey] -= needed;
    }
  } else {
    // When user decreases targetKey, re-allocate the freed amount to holders or creator
    const freed = Math.abs(delta);
    const recipientKey: keyof RevenueSplit = targetKey === 'creator' ? 'holders' : 'creator';
    next[recipientKey] = Math.min(100, next[recipientKey] + freed);
  }

  return next;
}

/**
 * Computes SVG stroke-dasharray and stroke-dashoffset values for a 4-color circular donut chart.
 */
export function calculateDonutSegments(
  split: RevenueSplit,
  radius = 38,
): { circumference: number; segments: Record<keyof RevenueSplit, DonutSegment> } {
  const circumference = 2 * Math.PI * radius; // 238.761 for r=38
  const keys: (keyof RevenueSplit)[] = ['creator', 'buyback', 'holders', 'growth'];

  let accumulatedStroke = 0;
  const segments = {} as Record<keyof RevenueSplit, DonutSegment>;

  for (const key of keys) {
    const share = Math.max(0, Number(split[key]) || 0);
    const stroke = (share / 100) * circumference;
    const offset = accumulatedStroke === 0 ? 0 : -accumulatedStroke;
    segments[key] = { key, share, stroke, offset };
    accumulatedStroke += stroke;
  }

  return { circumference, segments };
}

/** On-chain GotonFeeSplitter split of the post-protocol remainder (sums to exactly 10,000 bps). */
export interface RevenueSplitBps {
  holdersBps: number;
  burnBps: number;
  creatorBps: number;
  liquidityBps: number;
}

/**
 * Converts a UI revenue split (percentages: creator / buyback / holders / growth) into the
 * GotonFeeSplitter bps layout (buyback → burn, growth → liquidity). Shares are normalised to
 * their total so the result always sums to 10,000; rounding dust goes to the largest share.
 * An empty split sends everything to the creator.
 */
export function revenueSplitToBps(split?: Partial<RevenueSplit> | null): RevenueSplitBps {
  const parts = {
    holdersBps: Math.max(0, Number(split?.holders) || 0),
    burnBps: Math.max(0, Number(split?.buyback) || 0),
    creatorBps: Math.max(0, Number(split?.creator) || 0),
    liquidityBps: Math.max(0, Number(split?.growth) || 0),
  };
  const total = parts.holdersBps + parts.burnBps + parts.creatorBps + parts.liquidityBps;
  if (total <= 0) return { holdersBps: 0, burnBps: 0, creatorBps: 10_000, liquidityBps: 0 };

  const keys = Object.keys(parts) as (keyof RevenueSplitBps)[];
  const result = Object.fromEntries(
    keys.map((k) => [k, Math.floor((parts[k] / total) * 10_000)]),
  ) as unknown as RevenueSplitBps;
  const dust = 10_000 - keys.reduce((sum, k) => sum + result[k], 0);
  const largest = keys.reduce((a, b) => (parts[b] > parts[a] ? b : a));
  result[largest] += dust;
  return result;
}
