/**
 * Port interface for retrieving live cryptocurrency prices.
 */
export interface PriceFeedPort {
  /**
   * Returns the current price of Ethereum in USD.
   */
  getEthPriceUsd(): Promise<number>;

  /**
   * Returns the current USD price of the quote/gas asset for the given chain.
   * Arc Network (5042) returns 1.0 (USDC standard).
   * Robinhood Chain (4663) returns Ethereum price.
   */
  getQuoteAssetPriceUsd(chainId: number): Promise<number>;
}
