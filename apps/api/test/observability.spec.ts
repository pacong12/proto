import { describe, it, expect, vi } from 'vitest';
import { StructuredLoggerService } from '../src/modules/observability/infrastructure/structured-logger.service';
import { HttpRequestTracker } from '../src/modules/observability/presentation/http-request-tracker';
import { DevopsController } from '../src/modules/observability/presentation/devops.controller';
import { LoggerPort } from '../src/modules/observability/domain/ports/logger.port';
import { server } from '../src/server';

describe('Observability & DevOps Tracking', () => {
  it('formats structured log entries as valid JSON', () => {
    const logger = new StructuredLoggerService('test-service', false);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    logger.info('Test event message', { requestId: 'req-123', path: '/api/test' });

    expect(stdoutSpy).toHaveBeenCalled();
    const rawOutput = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(rawOutput);

    expect(parsed.service).toBe('test-service');
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Test event message');
    expect(parsed.context.requestId).toBe('req-123');

    stdoutSpy.mockRestore();
  });

  it('tracks HTTP request duration and attaches correlation ID header', () => {
    const mockLogger: LoggerPort = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const tracker = new HttpRequestTracker(mockLogger);
    const req = new Request('http://localhost:3001/api/tokens', {
      headers: { 'x-request-id': 'trace-abc-456' },
    });
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });

    const tracked = tracker.track(req, res, performance.now() - 50, 'trace-abc-456', '127.0.0.1');

    expect(tracked.headers.get('x-request-id')).toBe('trace-abc-456');
    expect(tracked.headers.get('server-timing')).toContain('total;dur=');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('HTTP GET /api/tokens -> 200'),
      expect.objectContaining({
        requestId: 'trace-abc-456',
        path: '/api/tokens',
        status: 200,
      }),
    );
  });

  it('returns structured telemetry and Prometheus metrics from DevopsController', () => {
    const mockLogger: LoggerPort = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const tracker = new HttpRequestTracker(mockLogger);
    const req = new Request('http://localhost:3001/api/tokens');
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    tracker.track(req, res, performance.now() - 10, 'req-999', '127.0.0.1');

    const controller = new DevopsController(tracker);
    const telemetry = controller.getTelemetry();

    expect(telemetry.success).toBe(true);
    expect(telemetry.data.traffic.totalRequests).toBe(1);
    expect(telemetry.data.traffic.statusCounts['2xx']).toBe(1);
    expect(telemetry.data.recentRequests.length).toBe(1);

    const prom = controller.getPrometheusMetrics();
    expect(prom).toContain('http_requests_total{status="2xx"} 1');
    expect(prom).toContain('process_resident_memory_bytes');

    const html = controller.getDashboardHtml();
    expect(html).toContain('Proto Protocol · DevOps Observability');
    expect(html).toContain('Live Request Stream');
  });

  it('serves /devops dashboard and /api/devops/telemetry over HTTP', async () => {
    const dashboardReq = new Request('http://localhost:3001/devops');
    const dashboardRes = await server.fetch(dashboardReq);
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.headers.get('content-type')).toContain('text/html');
    const html = await dashboardRes.text();
    expect(html).toContain('Proto Protocol · DevOps Observability');

    const telemetryReq = new Request('http://localhost:3001/api/devops/telemetry');
    const telemetryRes = await server.fetch(telemetryReq);
    expect(telemetryRes.status).toBe(200);
    const json = await telemetryRes.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('traffic');

    const metricsReq = new Request('http://localhost:3001/api/devops/metrics');
    const metricsRes = await server.fetch(metricsReq);
    expect(metricsRes.status).toBe(200);
    const promText = await metricsRes.text();
    expect(promText).toContain('http_requests_total');
  });
});
