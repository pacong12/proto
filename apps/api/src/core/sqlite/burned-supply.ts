/**
 * Market cap net of burned tokens. Burns send tokens to 0xdEaD (buybacks, LP token fees), which
 * leaves totalSupply on-chain unchanged, so a market cap of price x totalSupply counted them as
 * if they could still be sold. As DEX Screener ((total - burned) x price) and Pons (price x
 * (total supply - burned supply)) do, the burn addresses' indexed balances are taken off; FDV
 * stays price x the minted total. Every launch token has 18 decimals.
 *
 * `market` is the alias of a market_data row in the query; the result is an SQL expression.
 */
export function burnAdjustedMarketCapSql(market: string): string {
  return `MAX(0, ${market}.marketCapUsd - ${market}.priceUsd * COALESCE((
    SELECT SUM(CAST(b.balance AS REAL)) FROM token_balances b
    WHERE b.token_address = ${market}.address COLLATE NOCASE
      AND b.holder IN ('${DEAD}', '${ZERO}')
  ), 0) / 1e18)`;
}

const DEAD = '0x000000000000000000000000000000000000dead';
const ZERO = '0x0000000000000000000000000000000000000000';
