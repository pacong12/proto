import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { SqliteOrderStore } from './sqlite-order.store';

/**
 * The API's SQLite storage. Each aggregate lives in its own layer:
 * SqliteDatabase → SqliteTokenStore → SqliteTradeStore → SqliteSocialStore → SqliteOrderStore.
 */
export class SqliteTokenRepository extends SqliteOrderStore implements TokenRepositoryPort {}
