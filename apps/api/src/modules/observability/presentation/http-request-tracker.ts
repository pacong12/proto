import { LoggerPort } from '../domain/ports/logger.port';
import { CachePort } from '../domain/ports/cache.port';
import {
  ErrorMetricEntry,
  RequestMetricEntry,
  SystemTelemetry,
} from '../domain/ports/telemetry.port';

export class HttpRequestTracker {
  private readonly maxEntries = 100;
  private readonly recentRequests: RequestMetricEntry[] = [];
  private readonly recentErrors: ErrorMetricEntry[] = [];
  private totalRequests = 0;
  private totalDurationMs = 0;
  private statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  private minuteRequestTimestamps: number[] = [];

  constructor(
    private readonly logger: LoggerPort,
    private readonly cache?: CachePort,
  ) {}

  extractRequestId(req: Request): string {
    return req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID();
  }

  track(
    req: Request,
    res: Response,
    startTime: number,
    requestId: string,
    clientIp: string,
    errorPayload?: { message: string; stack?: string },
  ): Response {
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const url = new URL(req.url);
    const status = res.status;
    const now = Date.now();
    const isoTimestamp = new Date(now).toISOString();

    // 1. Update Aggregate Traffic Counters
    this.totalRequests++;
    this.totalDurationMs += durationMs;
    this.minuteRequestTimestamps.push(now);

    if (status >= 500) {
      this.statusCounts['5xx']++;
    } else if (status >= 400) {
      this.statusCounts['4xx']++;
    } else if (status >= 300) {
      this.statusCounts['3xx']++;
    } else {
      this.statusCounts['2xx']++;
    }

    // 2. Append to Ring Buffer
    const metricEntry: RequestMetricEntry = {
      timestamp: isoTimestamp,
      requestId,
      method: req.method,
      path: url.pathname,
      query: url.search,
      status,
      durationMs,
      ip: clientIp,
      userAgent: req.headers.get('user-agent') || 'unknown',
    };

    this.recentRequests.unshift(metricEntry);
    if (this.recentRequests.length > this.maxEntries) {
      this.recentRequests.pop();
    }

    if (status >= 400 && errorPayload) {
      this.recentErrors.unshift({
        timestamp: isoTimestamp,
        requestId,
        method: req.method,
        path: url.pathname,
        status,
        message: errorPayload.message,
        stack: errorPayload.stack,
        ip: clientIp,
      });
      if (this.recentErrors.length > 50) {
        this.recentErrors.pop();
      }
    }

    // 3. Emit Structured Logger Event
    const message = `HTTP ${req.method} ${url.pathname} -> ${status} (${durationMs}ms)`;
    const logContext = {
      requestId,
      method: req.method,
      path: url.pathname,
      query: url.search,
      status,
      durationMs,
      ip: clientIp,
      userAgent: metricEntry.userAgent,
    };

    if (status >= 500) {
      this.logger.error(message, logContext);
    } else if (status >= 400) {
      this.logger.warn(message, logContext);
    } else {
      this.logger.info(message, logContext);
    }

    // 4. Attach Observability Headers
    const headers = new Headers(res.headers);
    headers.set('x-request-id', requestId);
    headers.set('server-timing', `total;dur=${durationMs}`);

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  getTelemetry(): SystemTelemetry {
    const mem = process.memoryUsage();
    const now = Date.now();
    // Prune timestamps older than 60s
    this.minuteRequestTimestamps = this.minuteRequestTimestamps.filter((ts) => now - ts < 60_000);

    const avgLatency =
      this.totalRequests > 0
        ? Math.round((this.totalDurationMs / this.totalRequests) * 100) / 100
        : 0;

    return {
      service: 'proto-api',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: now,
      cache: {
        type: this.cache ? (this.cache.isAvailable() ? 'redis' : 'fallback') : 'none',
        available: this.cache ? this.cache.isAvailable() : false,
      },
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        externalMb: Math.round(mem.external / 1024 / 1024),
      },
      traffic: {
        totalRequests: this.totalRequests,
        activeRequestsPerMinute: this.minuteRequestTimestamps.length,
        avgLatencyMs: avgLatency,
        statusCounts: { ...this.statusCounts },
      },
      recentRequests: [...this.recentRequests],
      recentErrors: [...this.recentErrors],
    };
  }
}
