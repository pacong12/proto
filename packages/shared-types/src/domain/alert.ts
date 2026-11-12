/** A wallet's alert for when a token reaches a target price or market cap. */
export interface PriceAlert {
  id: string;
  /** The wallet that owns the alert. */
  wallet: `0x${string}`;
  tokenAddress: `0x${string}`;
  chainId: number;
  /** Whether the threshold is a USD price or a USD market cap. */
  kind: 'price' | 'mcap';
  /** Fire when the value crosses the threshold in this direction. */
  direction: 'above' | 'below';
  /** The USD threshold. */
  threshold: number;
  status: 'open' | 'triggered';
  createdAt: number;
  /** When it fired, or null while still open. */
  triggeredAt?: number | null;
}
