/** Up, down or flat over the window (a 0.01% move counts as flat). */
export type SparkTrend = 'up' | 'down' | 'flat';

/**
 * SVG path for a list sparkline, scaled to its own min/max. Fewer than two points, or a flat
 * series, draws a level line through the middle so a quiet token does not look like it rose.
 */
export function sparklinePath(
  points: readonly number[] | undefined,
  width: number,
  height: number,
  pad = 2,
): { d: string; trend: SparkTrend } {
  const pts = (points ?? []).filter((p) => Number.isFinite(p) && p > 0);
  const mid = height / 2;
  const flat = { d: `M 0 ${mid} L ${width} ${mid}`, trend: 'flat' as const };
  if (pts.length < 2) return flat;

  const first = pts[0];
  const last = pts[pts.length - 1];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  if (max - min <= max * 1e-4) return flat;

  const step = width / (pts.length - 1);
  const y = (p: number) => pad + (1 - (p - min) / (max - min)) * (height - pad * 2);
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${y(p).toFixed(1)}`)
    .join(' ');
  const change = (last - first) / first;
  const trend = Math.abs(change) < 1e-4 ? 'flat' : change > 0 ? 'up' : 'down';
  return { d, trend };
}
