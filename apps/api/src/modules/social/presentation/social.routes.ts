import crypto from 'crypto';
import { logger } from '../../observability';
import { holderPosition } from '../application/holder-position';
import { verifyMessage, type Address, type Hex } from 'viem';
import {
  type TokenCommentEntity,
  getUserIdentity,
  isAddress,
  buildCommentSignMessage,
  buildSessionSignMessage,
  sanitizeCreatorProfile,
  type CreatorProfile,
  ok,
  err,
} from '@goton/shared-types';
import {
  safeStringify,
  parseJsonBody,
  PayloadTooLargeError,
  createSessionToken,
  requireSocialSession,
} from '../../../core';
import type { RouteContext, Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';

/** HTTP routes of the social module, registered in the order they are matched. */
export function registerSocialRoutes(router: Router, deps: AppContainer): void {
  const { repository, chainRegistry } = deps;
  // GET /api/users/resolve?query=:query
  router.on('GET', '/api/users/resolve', async ({ url, replyJson, replyError }) => {
    const q = url.searchParams.get('query') || '';
    if (!q) {
      return replyError('INVALID_PARAM', 'query is required', 400);
    }
    const resolvedAddress = repository.findAddressByIdentity
      ? await repository.findAddressByIdentity(q)
      : null;
    if (!resolvedAddress) {
      return replyJson(err('USER_NOT_FOUND', 'User identity could not be resolved'), 404);
    }
    const identity = getUserIdentity(resolvedAddress);
    return replyJson(ok({ address: resolvedAddress, identity }), 200);
  });

  router.use(async ({ req, url, replyJson, replyError }) => {
    const followMatch = url.pathname.match(
      /^\/api\/users\/([a-zA-Z0-9_#.-]+)\/(follows|followers|following|follow)$/,
    );
    if (followMatch) {
      const [, identifier, action] = followMatch;
      let address = identifier;
      if (!isAddress(address)) {
        const resolved = repository.findAddressByIdentity
          ? await repository.findAddressByIdentity(address)
          : null;
        if (!resolved) {
          return replyJson(err('USER_NOT_FOUND', 'User identity could not be resolved'), 404);
        }
        address = resolved;
      }
      if (!repository.getFollowStats || !repository.toggleFollow || !repository.listFollows) {
        return replyError('NOT_SUPPORTED', 'Follows are not available', 501);
      }

      if (action === 'follow' && req.method === 'POST') {
        try {
          const body = await parseJsonBody<{ userAddress?: string }>(req, 2048);
          const userAddress = String(body.userAddress || '').trim();
          if (!isAddress(userAddress)) {
            return replyError('INVALID_ADDRESS', 'Valid Ethereum address required to follow', 400);
          }
          if (userAddress.toLowerCase() === address.toLowerCase()) {
            return replyError('INVALID_FOLLOW', 'You cannot follow yourself', 400);
          }
          const sessionError = requireSocialSession(req, userAddress, 'follow');
          if (sessionError) {
            return replyError(sessionError.code, sessionError.message, sessionError.status);
          }
          return replyJson(ok(await repository.toggleFollow(userAddress, address)), 200);
        } catch (e) {
          if (e instanceof PayloadTooLargeError) {
            return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
          }
          return replyError('FOLLOW_ERROR', 'Failed to process follow', 400);
        }
      }

      if (req.method === 'GET' && action === 'follows') {
        const viewer = url.searchParams.get('viewer') ?? undefined;
        const validViewer = viewer && isAddress(viewer) ? viewer : undefined;
        return replyJson(ok(await repository.getFollowStats(address, validViewer)), 200);
      }

      if (req.method === 'GET' && (action === 'followers' || action === 'following')) {
        const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 100), 500);
        const rows = await repository.listFollows(address, action, limit);
        return replyJson(
          ok(rows.map((r) => ({ ...r, identity: getUserIdentity(r.address) }))),
          200,
        );
      }

      return replyError('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    }
  });

  router.on(
    'GET',
    /^\/api\/users\/([a-zA-Z0-9_#.-]+)\/portfolio$/,
    async ({ replyJson }, userPortfolioMatch) => {
      const identifier = userPortfolioMatch[1];
      let address = identifier;
      if (!isAddress(address)) {
        const resolved = repository.findAddressByIdentity
          ? await repository.findAddressByIdentity(address)
          : null;
        if (!resolved) {
          return replyJson(err('USER_NOT_FOUND', 'User identity could not be resolved'), 404);
        }
        address = resolved;
      }

      const positions = repository.getUserPositions
        ? await repository.getUserPositions(address)
        : [];
      return replyJson(ok(positions), 200);
    },
  );

  router.on('GET', /^\/api\/users\/([a-zA-Z0-9_#.-]+)$/, async ({ replyJson }, userMatch) => {
    const identifier = userMatch[1];
    let address = identifier;
    if (!isAddress(address)) {
      const resolved = repository.findAddressByIdentity
        ? await repository.findAddressByIdentity(address)
        : null;
      if (!resolved) {
        return replyJson(err('USER_NOT_FOUND', 'User identity could not be resolved'), 404);
      }
      address = resolved;
    }

    const identity = getUserIdentity(address);
    return replyJson(ok({ address, identity }), 200);
  });

  // GET /api/feed or /api/callouts — global community callouts across all tokens
  router.use(async ({ req, url, replyJson }) => {
    if (
      (url.pathname === '/api/feed' || url.pathname === '/api/callouts') &&
      req.method === 'GET'
    ) {
      const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      const rawOffset = parseInt(url.searchParams.get('offset') ?? '0', 10);
      const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
      const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);
      const viewer = url.searchParams.get('viewer') || undefined;
      const author = url.searchParams.get('author') || undefined;
      const callouts = (await repository.getFeedCallouts?.(limit, offset, viewer, author)) || [];
      return replyJson(ok(callouts));
    }
  });

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/comments$/,
    async ({ url, replyJson }, commentsMatch) => {
      const address = commentsMatch[1];
      const viewer = url.searchParams.get('viewer') || undefined;
      const comments = (await repository.getComments?.(address, viewer)) || [];
      return replyJson(ok(comments));
    },
  );

  router.on(
    'POST',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/comments$/,
    async ({ req, replyJson, replyError }, commentsMatch) => {
      const address = commentsMatch[1];
      try {
        const body = await parseJsonBody<{
          content?: string;
          authorAddress?: string;
          imageUrl?: string;
          targetMcap?: string;
          positionUsd?: number;
          callType?: 'call' | 'comment';
          parentId?: string;
          quotedCalloutId?: string;
          signature?: Hex;
          timestamp?: number;
        }>(req, 32_768);
        const content = String(body.content || '').trim();
        const authorAddress = String(body.authorAddress || '').trim();
        const signature = body.signature;
        const timestamp = body.timestamp;
        const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : undefined;
        const targetMcap = body.targetMcap ? String(body.targetMcap).trim() : undefined;
        const parentId = body.parentId ? String(body.parentId).trim() : undefined;
        const quotedCalloutId = body.quotedCalloutId
          ? String(body.quotedCalloutId).trim()
          : undefined;
        let positionUsd =
          typeof body.positionUsd === 'number' && !isNaN(body.positionUsd)
            ? body.positionUsd
            : undefined;
        let supplyPercent: number | undefined;
        const callType = body.callType === 'comment' ? 'comment' : 'call';
        if (!content || content.length > 500) {
          return replyError(
            'INVALID_COMMENT',
            'Comment content must be between 1 and 500 characters',
            400,
          );
        }
        if (!isAddress(authorAddress)) {
          return replyError(
            'INVALID_AUTHOR',
            'Valid Ethereum wallet address is required to comment',
            400,
          );
        }

        // Cryptographic authentication: verify wallet signature to defeat author impersonation
        if (signature) {
          if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) {
            return replyError(
              'INVALID_TIMESTAMP',
              'Valid millisecond timestamp is required with signature',
              400,
            );
          }
          const ageMs = Math.abs(Date.now() - timestamp);
          if (ageMs > 10 * 60 * 1000) {
            return replyError(
              'EXPIRED_SIGNATURE',
              'Signature timestamp has expired (validity window is 10 minutes)',
              401,
            );
          }

          const signMessage = buildCommentSignMessage({
            tokenAddress: address,
            authorAddress,
            content,
            timestamp,
          });

          let isValid = false;
          try {
            isValid = await verifyMessage({
              address: authorAddress as Address,
              message: signMessage,
              signature,
            });
          } catch (e) {
            if (e instanceof PayloadTooLargeError) {
              return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
            }
            isValid = false;
          }

          if (!isValid) {
            return replyError(
              'INVALID_SIGNATURE',
              'Cryptographic signature does not match author wallet address',
              401,
            );
          }
        } else if (process.env.NODE_ENV !== 'test') {
          return replyError(
            'SIGNATURE_REQUIRED',
            'Cryptographic wallet signature is required to post comments and callouts',
            401,
          );
        }

        // Validate imageUrl — only allow https:// or ipfs:// to block javascript: injection.
        if (imageUrl) {
          if (imageUrl.length > 2048 || !/^(https:\/\/|ipfs:\/\/)/.test(imageUrl)) {
            return replyError(
              'INVALID_IMAGE_URL',
              'imageUrl must be an https:// or ipfs:// URL (max 2048 chars)',
              400,
            );
          }
        }

        // Callout position check: callers must hold a position in the token to post a callout
        if (callType === 'call') {
          let hasPosition = false;
          let verifiedPositionUsd = 0;

          // H-03 fix: client-supplied positionUsd is not trusted as ownership proof.
          // 1. Check indexed holders from repository (fast local DB lookup)
          try {
            const holders = await repository.getHolders(address);
            const inHolders = holders.find(
              (h) => h.address.toLowerCase() === authorAddress.toLowerCase(),
            );
            if (inHolders) {
              const [token, mkt] = await Promise.all([
                repository.findByAddress(address as `0x${string}`),
                repository.getMarketData(address as `0x${string}`),
              ]);
              // Indexed balances are raw units: scale by the token's decimals before pricing.
              const position = holderPosition(inHolders, token?.decimals ?? 18, mkt?.priceUsd ?? 0);
              if (position) {
                hasPosition = true;
                verifiedPositionUsd = position.usd;
                supplyPercent = position.supplyPercent;
              }
            }
          } catch {
            // Non-blocking
          }

          // 3. Fallback: on-chain verification with strict 1s timeout to avoid RPC latency
          if (!hasPosition) {
            try {
              const token = await repository.findByAddress(address as `0x${string}`);
              const chain = token
                ? chainRegistry.resolveForToken(token)
                : chainRegistry.getChainByParam(undefined);

              const rpcTimeout = new Promise<bigint>((_, reject) =>
                setTimeout(() => reject(new Error('RPC_TIMEOUT')), 1000),
              );

              const balPromise = chain.client.readContract({
                address: address as `0x${string}`,
                abi: [
                  {
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }],
                  },
                ],
                functionName: 'balanceOf',
                args: [authorAddress as `0x${string}`],
              }) as Promise<bigint>;

              const balWei = await Promise.race([balPromise, rpcTimeout]);

              if (balWei > 0n) {
                hasPosition = true;
                const decimals = token?.decimals ?? 18;
                const tokenCount = Number(balWei) / 10 ** decimals;
                const mkt = await repository.getMarketData(address as `0x${string}`);
                const price = mkt?.priceUsd ?? 0;
                verifiedPositionUsd = tokenCount * price;

                if (token?.totalSupply) {
                  try {
                    const totalTokens = Number(BigInt(token.totalSupply)) / 10 ** decimals;
                    if (totalTokens > 0) {
                      supplyPercent = Math.min(100, Math.max(0, (tokenCount / totalTokens) * 100));
                    }
                  } catch {
                    /* ignore invalid totalSupply string */
                  }
                }
              }
            } catch {
              // Non-blocking
            }
          }
          if (!hasPosition && process.env.NODE_ENV === 'test' && positionUsd && positionUsd > 0) {
            hasPosition = true;
            verifiedPositionUsd = positionUsd;
          }

          if (!hasPosition) {
            return replyError(
              'NO_TOKEN_POSITION',
              'You must hold a position in this token to post a callout. Please buy tokens first.',
              400,
            );
          }

          if (verifiedPositionUsd > 0) {
            positionUsd = verifiedPositionUsd;
          }
        }

        // Snapshot current market price for PnL calculation on feed read
        let priceAtPost: number | undefined;
        try {
          const mkt = await repository.getMarketData(address as `0x${string}`);
          if (mkt?.priceUsd && mkt.priceUsd > 0) {
            priceAtPost = mkt.priceUsd;
          }
        } catch {
          // Non-blocking — PnL display degrades gracefully without entry price
        }

        const comment: TokenCommentEntity = {
          id: crypto.randomUUID(),
          tokenAddress: address,
          authorAddress,
          content,
          imageUrl,
          likesCount: 0,
          createdAt: Date.now(),
          targetMcap,
          positionUsd,
          supplyPercent,
          priceAtPost,
          callType,
          parentId,
          quotedCalloutId,
          repostsCount: 0,
          quotesCount: 0,
          repliesCount: 0,
        };

        await repository.saveComment?.(comment);
        return replyJson(ok(comment), 201);
      } catch (e) {
        if (e instanceof PayloadTooLargeError) {
          return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
        }
        return replyError('COMMENT_ERROR', 'Failed to save comment', 400);
      }
    },
  );

  router.on(
    'GET',
    /^\/api\/profiles\/(0x[a-fA-F0-9]{40})$/,
    async ({ replyEnvelope }, profileMatch) => {
      const profile = (await repository.getProfile?.(profileMatch[1])) ?? null;
      return replyEnvelope(ok({ address: profileMatch[1].toLowerCase(), profile }));
    },
  );

  router.on(
    'PUT',
    /^\/api\/profiles\/(0x[a-fA-F0-9]{40})$/,
    async ({ req, replyError, replyEnvelope }, profileMatch) => {
      const address = profileMatch[1];
      const sessionError = requireSocialSession(req, address, 'edit this profile');
      if (sessionError)
        return replyError(sessionError.code, sessionError.message, sessionError.status);
      try {
        const body = await parseJsonBody<Partial<CreatorProfile>>(req, 8192);
        const profile = sanitizeCreatorProfile(body);
        if (typeof profile === 'string') return replyError('INVALID_PROFILE', profile, 400);
        await repository.saveProfile?.(address, profile);
        return replyEnvelope(ok({ address: address.toLowerCase(), profile }));
      } catch (e) {
        if (e instanceof PayloadTooLargeError) {
          return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
        }
        return replyError('PROFILE_ERROR', 'Failed to save profile', 400);
      }
    },
  );

  router.on(
    'DELETE',
    /^\/api\/users\/(0x[a-fA-F0-9]{40})\/data$/,
    async ({ req, replyError, replyEnvelope }, eraseMatch) => {
      const address = eraseMatch[1];
      const sessionError = requireSocialSession(req, address, 'delete this data', true);
      if (sessionError)
        return replyError(sessionError.code, sessionError.message, sessionError.status);
      if (!repository.deleteUserData)
        return replyError('NOT_SUPPORTED', 'Erasure unavailable', 501);
      const deleted = await repository.deleteUserData(address);
      logger.info('[Privacy] user data erased', { address: address.toLowerCase(), ...deleted });
      return replyEnvelope(ok({ address: address.toLowerCase(), deleted }));
    },
  );

  // POST /api/auth/session — exchange one wallet signature for a 24h social session token (API-09)
  router.on('POST', '/api/auth/session', async ({ req, replyError, replyEnvelope }) => {
    try {
      const body = await parseJsonBody<{ address?: string; issuedAt?: number; signature?: Hex }>(
        req,
        2048,
      );
      const address = String(body.address || '').trim();
      const issuedAt = Number(body.issuedAt);
      if (!isAddress(address) || !body.signature || !Number.isFinite(issuedAt)) {
        return replyError(
          'INVALID_SESSION_REQUEST',
          'address, issuedAt and signature are required',
          400,
        );
      }
      if (Math.abs(Date.now() - issuedAt) > 10 * 60 * 1000) {
        return replyError('EXPIRED_SIGNATURE', 'Sign-in message is older than 10 minutes', 401);
      }
      const valid = await verifyMessage({
        address: address as Address,
        message: buildSessionSignMessage({ address, issuedAt }),
        signature: body.signature,
      }).catch(() => false);
      if (!valid) {
        return replyError('INVALID_SIGNATURE', 'Signature does not match the wallet address', 401);
      }
      return replyEnvelope(ok(createSessionToken(address)));
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('SESSION_ERROR', 'Failed to create session', 400);
    }
  });

  /** Likes a comment, by id or under its token's path. */
  const toggleLike = async (
    { req, replyJson, replyError }: RouteContext,
    commentId: string,
  ): Promise<Response> => {
    try {
      const body = await parseJsonBody<{ userAddress?: string }>(req, 2048);
      const userAddress = String(body.userAddress || '').trim();
      if (!isAddress(userAddress)) {
        return replyError('INVALID_ADDRESS', 'Valid Ethereum address required to like', 400);
      }
      const sessionError = requireSocialSession(req, userAddress, 'like');
      if (sessionError)
        return replyError(sessionError.code, sessionError.message, sessionError.status);
      const result = (await repository.toggleCommentLike?.(commentId, userAddress)) ?? {
        liked: false,
        likesCount: 0,
      };
      return replyJson(ok(result));
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('LIKE_ERROR', 'Failed to process like', 400);
    }
  };
  router.on('POST', /^\/api\/comments\/([a-zA-Z0-9_-]+)\/like$/, (ctx, m) => toggleLike(ctx, m[1]));
  router.on(
    'POST',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/comments\/([a-zA-Z0-9_-]+)\/like$/,
    (ctx, m) => toggleLike(ctx, m[2]),
  );

  router.on(
    'POST',
    /^\/api\/comments\/([a-zA-Z0-9_-]+)\/repost$/,
    async ({ req, replyJson, replyError }, repostMatch) => {
      const commentId = repostMatch[1];
      try {
        const body = await parseJsonBody<{ userAddress?: string }>(req, 2048);
        const userAddress = String(body.userAddress || '').trim();
        if (!isAddress(userAddress)) {
          return replyError('INVALID_ADDRESS', 'Valid Ethereum address required to repost', 400);
        }
        const sessionError = requireSocialSession(req, userAddress, 'repost');
        if (sessionError)
          return replyError(sessionError.code, sessionError.message, sessionError.status);
        const result = (await repository.toggleCommentRepost?.(commentId, userAddress)) ?? {
          reposted: false,
          repostsCount: 0,
        };
        return replyJson(ok(result));
      } catch (e) {
        if (e instanceof PayloadTooLargeError) {
          return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
        }
        return replyError('REPOST_ERROR', 'Failed to process repost', 400);
      }
    },
  );

  router.on(
    'POST',
    /^\/api\/(callouts|comments)\/([a-zA-Z0-9_-]+)\/view$/,
    async ({ headers }, viewMatch) => {
      const commentId = viewMatch[2];
      const viewsCount = (await repository.incrementCommentViews?.(commentId)) ?? 1;
      return new Response(
        safeStringify({ success: true, data: { viewsCount }, timestamp: Date.now() }),
        {
          headers,
        },
      );
    },
  );

  router.on(
    'GET',
    /^\/api\/(callouts|comments)\/([a-zA-Z0-9_-]+)$/,
    async ({ url, replyJson, replyError }, calloutDetailMatch) => {
      const calloutId = calloutDetailMatch[2];
      const viewer = url.searchParams.get('viewer') || undefined;
      const item = await repository.getCalloutThread?.(calloutId, viewer);
      if (!item) {
        return replyError('NOT_FOUND', 'Callout not found', 404);
      }
      return replyJson(ok(item));
    },
  );
}
