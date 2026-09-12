import { describe, it, expect, vi } from 'vitest';
import { StructuredLoggerService } from '../src/modules/observability/infrastructure/structured-logger.service';
import { HttpRequestTracker } from '../src/modules/observability/presentation/http-request-tracker';
import { LoggerPort } from '../src/modules/observability/domain/ports/logger.port';

describe('Observability & Structured Logging', () => {
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
});
