/**
 * Port interface for retrieving live cryptocurrency prices.
 */
export interface PriceFeedPort {
  /**
   * Returns the current price of Ethereum in USD.
   */
  getEthPriceUsd(): Promise<number>;
}
