import type { LaunchedTokenEntity } from '@goton/shared-types';
import type { TokenRepositoryPort } from '../domain/ports/token.repository.port';

const PAGE_SIZE = 500;

/**
 * Every stored token, newest first, read page by page. Keepers, the indexer and site-wide stats
 * must see all tokens: a fixed `findAll(n)` silently drops everything older than the newest n.
 */
export async function findAllTokens(
  repository: Pick<TokenRepositoryPort, 'findAll'>,
  filters?: { version?: 'v1' | 'v2'; deployer?: string },
): Promise<LaunchedTokenEntity[]> {
  const tokens: LaunchedTokenEntity[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await repository.findAll(PAGE_SIZE, offset, filters);
    tokens.push(...page);
    if (page.length < PAGE_SIZE) return tokens;
  }
}
