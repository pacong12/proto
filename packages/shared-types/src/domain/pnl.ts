/** A wallet's profit and loss on one token, from its indexed trades (USD at each trade's price). */
export interface PositionPnl {
  /** USD spent on buys. */
  investedUsd: number;
  /** USD received from sells. */
  proceedsUsd: number;
  /** Profit of the tokens sold, against their average cost. */
  realizedUsd: number;
  /** Profit of the tokens still held, at the current price. */
  unrealizedUsd: number;
  totalUsd: number;
  /** totalUsd as a percentage of investedUsd; null with nothing invested. */
  percent: number | null;
  holdingTokens: number;
  /** Market cap at the average buy price. */
  avgEntryMarketCapUsd: number | null;
  /** Market cap at the average sell price; null without sells. */
  avgExitMarketCapUsd: number | null;
  marketCapUsd: number;
  buys: number;
  sells: number;
  firstTradeAt: number | null;
  lastTradeAt: number | null;
  /** holding while the wallet keeps tokens, sold once it sold them all. */
  status: 'holding' | 'sold';
}

/** The shared PnL page: the position, its token and who holds it. */
export interface PnlShare {
  wallet: `0x${string}`;
  /** The wallet's profile name, else its generated username. */
  traderName: string;
  token: {
    address: `0x${string}`;
    name: string;
    symbol: string;
    logo: string;
    chainId: number;
  };
  pnl: PositionPnl;
}
