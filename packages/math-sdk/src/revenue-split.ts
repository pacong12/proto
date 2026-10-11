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
