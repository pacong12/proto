import type { createReplies } from './api-envelope';

/** What a route handler gets for one request. */
export interface RouteContext extends ReturnType<typeof createReplies> {
  req: Request;
  url: URL;
  clientIp: string;
  /** Security and CORS headers every response of this request carries. */
  headers: Record<string, string>;
  /** The CORS origin allowed for this request (streaming responses set their own headers). */
  corsOrigin: string;
}

/** Returns the response, or undefined to let the next matching route handle the request. */
type Handler<M> = (
  ctx: RouteContext,
  match: M,
) => Response | undefined | Promise<Response | undefined>;

interface Route {
  methods: readonly string[] | null;
  path: string | RegExp | null;
  handler: Handler<RegExpMatchArray>;
}

/**
 * Routes requests by method and path, in registration order. A path is an exact string or an
 * anchored RegExp whose match (with its capture groups) is passed to the handler.
 */
export class Router {
  private readonly routes: Route[] = [];

  on(
    method: string | readonly string[],
    path: string | RegExp,
    handler: Handler<RegExpMatchArray>,
  ): this {
    this.routes.push({ methods: typeof method === 'string' ? [method] : method, path, handler });
    return this;
  }

  /** A handler that sees every request and decides itself whether it applies (middleware). */
  use(handler: Handler<RegExpMatchArray>): this {
    this.routes.push({ methods: null, path: null, handler });
    return this;
  }

  async handle(ctx: RouteContext): Promise<Response | undefined> {
    for (const route of this.routes) {
      if (route.methods && !route.methods.includes(ctx.req.method)) continue;
      let match: RegExpMatchArray | null = [ctx.url.pathname];
      if (typeof route.path === 'string') {
        if (ctx.url.pathname !== route.path) continue;
      } else if (route.path) {
        match = ctx.url.pathname.match(route.path);
        if (!match) continue;
      }
      const res = await route.handler(ctx, match);
      if (res) return res;
    }
    return undefined;
  }
}
