import crypto from 'crypto';
import { safeStringify, safeTokenCompare } from '../../../core';
import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';

const DEVOPS_PATHS = new Set(['/devops', '/api/devops/telemetry', '/api/devops/metrics']);

/** HTTP routes of the observability module, registered in the order they are matched. */
export function registerObservabilityRoutes(router: Router, deps: AppContainer): void {
  const { devopsController } = deps;

  // DevOps Observability Dashboard & Telemetry Endpoints — fail-closed auth.
  // If DEVOPS_AUTH_TOKEN is not configured, the routes are disabled entirely to prevent
  // accidental exposure of memory stats, request logs, and stack traces.
  router.use(({ req, url, headers, replyError }) => {
    if (!DEVOPS_PATHS.has(url.pathname)) return undefined;
    const devopsToken = process.env.DEVOPS_AUTH_TOKEN;
    // Fail-closed across production, staging, and development if token is not configured.
    // Only bypassed in test runner environment where mocks drive unauthenticated telemetry.
    if (!devopsToken && process.env.NODE_ENV !== 'test') {
      return replyError(
        'FORBIDDEN',
        'DevOps endpoints disabled: DEVOPS_AUTH_TOKEN not configured',
        403,
      );
    }
    if (!devopsToken) return undefined;
    const authHeader = req.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (safeTokenCompare(bearerToken, devopsToken)) return undefined;
    if (url.pathname === '/devops') {
      return new Response(
        devopsController.getLoginHtml(crypto.randomBytes(16).toString('base64')),
        {
          status: 401,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'WWW-Authenticate': 'Bearer realm="Goton DevOps"',
          },
        },
      );
    }
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Access denied. Valid DevOps token required.' },
      }),
      {
        status: 401,
        headers: { ...headers, 'WWW-Authenticate': 'Bearer realm="Goton DevOps"' },
      },
    );
  });

  router.use(({ url }) => {
    if (url.pathname !== '/devops') return undefined;
    return new Response(devopsController.getDashboardHtml(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });

  router.on('GET', '/api/devops/telemetry', ({ replyJson }) =>
    replyJson(devopsController.getTelemetry()),
  );

  router.on(
    'GET',
    '/api/devops/metrics',
    () =>
      new Response(devopsController.getPrometheusMetrics(), {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      }),
  );

  // Health probe: return minimal status only — no memory stats visible to public.
  // Memory diagnostics are available on the authenticated /api/devops/telemetry endpoint.
  router.use(({ url, headers }) => {
    if (url.pathname !== '/health' && url.pathname !== '/') return undefined;
    return new Response(
      safeStringify({
        status: 'ok',
        service: 'goton-api',
        timestamp: Date.now(),
      }),
      { headers },
    );
  });
}
