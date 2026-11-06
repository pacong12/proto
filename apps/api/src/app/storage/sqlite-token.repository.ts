import type { TokenRepositoryPort } from '../../core/ports/token.repository.port';
import { SqliteDatabase } from '../../core/sqlite/sqlite-database';
import { SqliteOrderStore } from '../../modules/limit-orders';
import { SqliteSocialStore } from '../../modules/social';
import { SqliteTokenStore } from '../../modules/tokens';
import { SqliteTradeStore } from '../../modules/trades';

/**
 * The API's SQLite storage: one connection, one store per aggregate. Consumers that need one
 * aggregate should depend on its own port.
 */
export class SqliteTokenRepository implements TokenRepositoryPort {
  private readonly database: SqliteDatabase;
  private readonly tokens: SqliteTokenStore;
  private readonly trades: SqliteTradeStore;
  private readonly social: SqliteSocialStore;
  private readonly orders: SqliteOrderStore;

  constructor(dbPath?: string) {
    this.database = new SqliteDatabase(dbPath);
    this.tokens = new SqliteTokenStore(this.database);
    this.trades = new SqliteTradeStore(this.database, this.tokens);
    this.social = new SqliteSocialStore(this.database);
    this.orders = new SqliteOrderStore(this.database);
  }

  backup: SqliteDatabase['backup'] = (...args) => this.database.backup(...args);
  close: SqliteDatabase['close'] = () => this.database.close();

  save: SqliteTokenStore['save'] = (...args) => this.tokens.save(...args);
  findByAddress: SqliteTokenStore['findByAddress'] = (...args) =>
    this.tokens.findByAddress(...args);
  findAll: SqliteTokenStore['findAll'] = (...args) => this.tokens.findAll(...args);
  saveMarketData: SqliteTokenStore['saveMarketData'] = (...args) =>
    this.tokens.saveMarketData(...args);
  findStaleMarketData: SqliteTokenStore['findStaleMarketData'] = (...args) =>
    this.tokens.findStaleMarketData(...args);
  getMarketData: SqliteTokenStore['getMarketData'] = (...args) =>
    this.tokens.getMarketData(...args);
  saveBalances: SqliteTokenStore['saveBalances'] = (...args) => this.tokens.saveBalances(...args);
  markHoldersIndexed: SqliteTokenStore['markHoldersIndexed'] = (...args) =>
    this.tokens.markHoldersIndexed(...args);
  getHolderIndexedTokens: SqliteTokenStore['getHolderIndexedTokens'] = (...args) =>
    this.tokens.getHolderIndexedTokens(...args);
  findByPoolAddress: SqliteTokenStore['findByPoolAddress'] = (...args) =>
    this.tokens.findByPoolAddress(...args);
  getLastIndexedBlock: SqliteTokenStore['getLastIndexedBlock'] = (...args) =>
    this.tokens.getLastIndexedBlock(...args);
  setLastIndexedBlock: SqliteTokenStore['setLastIndexedBlock'] = (...args) =>
    this.tokens.setLastIndexedBlock(...args);
  getTokenSentiment: SqliteTokenStore['getTokenSentiment'] = (...args) =>
    this.tokens.getTokenSentiment(...args);
  voteTokenSentiment: SqliteTokenStore['voteTokenSentiment'] = (...args) =>
    this.tokens.voteTokenSentiment(...args);
  recordBuybackBurn: SqliteTokenStore['recordBuybackBurn'] = (...args) =>
    this.tokens.recordBuybackBurn(...args);
  getBuybackTotals: SqliteTokenStore['getBuybackTotals'] = (...args) =>
    this.tokens.getBuybackTotals(...args);
  getBuybackStats: SqliteTokenStore['getBuybackStats'] = (...args) =>
    this.tokens.getBuybackStats(...args);

  getTradeFlow: SqliteTradeStore['getTradeFlow'] = (...args) => this.trades.getTradeFlow(...args);
  saveTrade: SqliteTradeStore['saveTrade'] = (...args) => this.trades.saveTrade(...args);
  getTrades: SqliteTradeStore['getTrades'] = (...args) => this.trades.getTrades(...args);
  getPriceAnchor: SqliteTradeStore['getPriceAnchor'] = (...args) =>
    this.trades.getPriceAnchor(...args);
  getCandlesticks: SqliteTradeStore['getCandlesticks'] = (...args) =>
    this.trades.getCandlesticks(...args);
  getHolders: SqliteTradeStore['getHolders'] = (...args) => this.trades.getHolders(...args);
  getRecentTrades: SqliteTradeStore['getRecentTrades'] = (...args) =>
    this.trades.getRecentTrades(...args);
  getTradesByTrader: SqliteTradeStore['getTradesByTrader'] = (...args) =>
    this.trades.getTradesByTrader(...args);
  getTradesInBlockRange: SqliteTradeStore['getTradesInBlockRange'] = (...args) =>
    this.trades.getTradesInBlockRange(...args);
  getTradesSince: SqliteTradeStore['getTradesSince'] = (...args) =>
    this.trades.getTradesSince(...args);
  findTradeByHash: SqliteTradeStore['findTradeByHash'] = (...args) =>
    this.trades.findTradeByHash(...args);
  getUserPositions: SqliteTradeStore['getUserPositions'] = (...args) =>
    this.trades.getUserPositions(...args);
  getVolumeByToken: SqliteTradeStore['getVolumeByToken'] = (...args) =>
    this.trades.getVolumeByToken(...args);

  getProfile: SqliteSocialStore['getProfile'] = (...args) => this.social.getProfile(...args);
  saveProfile: SqliteSocialStore['saveProfile'] = (...args) => this.social.saveProfile(...args);
  findAddressByIdentity: SqliteSocialStore['findAddressByIdentity'] = (...args) =>
    this.social.findAddressByIdentity(...args);
  saveComment: SqliteSocialStore['saveComment'] = (...args) => this.social.saveComment(...args);
  getComments: SqliteSocialStore['getComments'] = (...args) => this.social.getComments(...args);
  getFeedCallouts: SqliteSocialStore['getFeedCallouts'] = (...args) =>
    this.social.getFeedCallouts(...args);
  incrementCommentViews: SqliteSocialStore['incrementCommentViews'] = (...args) =>
    this.social.incrementCommentViews(...args);
  getCalloutThread: SqliteSocialStore['getCalloutThread'] = (...args) =>
    this.social.getCalloutThread(...args);
  toggleCommentRepost: SqliteSocialStore['toggleCommentRepost'] = (...args) =>
    this.social.toggleCommentRepost(...args);
  toggleFollow: SqliteSocialStore['toggleFollow'] = (...args) => this.social.toggleFollow(...args);
  getFollowStats: SqliteSocialStore['getFollowStats'] = (...args) =>
    this.social.getFollowStats(...args);
  listFollows: SqliteSocialStore['listFollows'] = (...args) => this.social.listFollows(...args);
  toggleCommentLike: SqliteSocialStore['toggleCommentLike'] = (...args) =>
    this.social.toggleCommentLike(...args);
  deleteUserData: SqliteSocialStore['deleteUserData'] = (...args) =>
    this.social.deleteUserData(...args);

  saveLimitOrder: SqliteOrderStore['saveLimitOrder'] = (...args) =>
    this.orders.saveLimitOrder(...args);
  adoptLimitOrders: SqliteOrderStore['adoptLimitOrders'] = (...args) =>
    this.orders.adoptLimitOrders(...args);
  updateLimitOrder: SqliteOrderStore['updateLimitOrder'] = (...args) =>
    this.orders.updateLimitOrder(...args);
  listLimitOrders: SqliteOrderStore['listLimitOrders'] = (...args) =>
    this.orders.listLimitOrders(...args);
}
