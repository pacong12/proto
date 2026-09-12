import { LoggerPort } from '../domain/ports/logger.port';

export class HttpRequestTracker {
  constructor(private readonly logger: LoggerPort) {}

  extractRequestId(req: Request): string {
    return req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID();
  }

  track(
    req: Request,
    res: Response,
    startTime: number,
    requestId: string,
    clientIp: string,
  ): Response {
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const url = new URL(req.url);
    const status = res.status;

    const logContext = {
      requestId,
      method: req.method,
      path: url.pathname,
      query: url.search,
      status,
      durationMs,
      ip: clientIp,
      userAgent: req.headers.get('user-agent') || 'unknown',
    };

    const message = `HTTP ${req.method} ${url.pathname} -> ${status} (${durationMs}ms)`;

    if (status >= 500) {
      this.logger.error(message, logContext);
    } else if (status >= 400) {
      this.logger.warn(message, logContext);
    } else {
      this.logger.info(message, logContext);
    }

    // Attach correlation ID to outgoing response headers
    const headers = new Headers(res.headers);
    headers.set('x-request-id', requestId);
    headers.set('server-timing', `total;dur=${durationMs}`);

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }
}
