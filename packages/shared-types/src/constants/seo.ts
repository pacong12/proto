/**
 * Search metadata shared by the edge worker (the HTML crawlers receive) and the app (set again
 * after it renders), so both give a page the same title, description and canonical URL.
 */

export const SEO_DEFAULT_TITLE = 'goton · Launch fixed-supply tokens on Robinhood Chain & Arc';
export const SEO_DEFAULT_DESCRIPTION =
  'goton is the non-custodial launchpad for fixed-supply tokens on Robinhood Chain and Arc. Launch on a bonding curve or straight into a locked Uniswap v4 pool, then trade, call and follow.';

export interface SeoCopy {
  /** Page name; the brand is appended (`Explore tokens · goton`). */
  title: string;
  description: string;
}

/** Title and description of each indexable static page, by canonical path. */
export const SEO_PAGES: Record<string, SeoCopy> = {
  '/launchpad': {
    title: 'Explore tokens',
    description:
      'Every token launched on goton, with live market cap, volume and price since launch.',
  },
  '/memestock': {
    title: 'Memestock',
    description:
      'Launches with a written thesis whose creator still holds a position they bought, ranked by trading in the last hour.',
  },
  '/feed': {
    title: 'Feed',
    description:
      'Calls from holders on goton tokens: theses, targets and the share of supply each caller held.',
  },
  '/analytics': {
    title: 'Analytics',
    description: 'Protocol volume, launches and deployed contracts on Robinhood Chain and Arc.',
  },
  '/launchpad/create': {
    title: 'Create a token',
    description: 'Launch a fixed-supply token on Robinhood Chain or Arc with locked liquidity.',
  },
};

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/** Whether `value` is a 0x-prefixed 20-byte hex address. */
export function isAddress(value: string): boolean {
  return ADDRESS.test(value);
}

/**
 * The canonical path of an app URL: no trailing slash, `/explore` is `/launchpad`, and a token
 * page under any of its aliases is `/token/<lowercase address>`.
 */
export function canonicalPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/explore') return '/launchpad';
  const token = /^\/(?:token|launchpad|trade)\/(0x[a-fA-F0-9]{40})$/.exec(path);
  if (token) return `/token/${token[1].toLowerCase()}`;
  return path;
}

/** Collapse whitespace and cut to `max` characters on a word boundary. */
export function clipText(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

/** Chain name used in token page titles, descriptions and text. */
export function seoChainName(chainId: number): string {
  return chainId === 5042 ? 'Arc' : 'Robinhood Chain';
}

/** Meta description of a token page: the creator's description, or a summary. */
export function tokenSeoDescription(
  name: string,
  symbol: string,
  chainName: string,
  description?: string,
): string {
  const own = description?.trim();
  if (own) return clipText(own, 155);
  return `Trade ${name} ($${symbol}) on ${chainName} on goton: price, chart, holders and live trades.`;
}
