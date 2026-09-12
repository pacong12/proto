interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startTime = performance.now();
    const url = new URL(request.url);
    const rayId = request.headers.get('cf-ray') || crypto.randomUUID();

    // Block direct scanning of dotfiles and sensitive config endpoints
    if (
      url.pathname.startsWith('/.') ||
      url.pathname.startsWith('/wp-admin') ||
      url.pathname.startsWith('/phpmyadmin') ||
      url.pathname.startsWith('/server-status') ||
      url.pathname.startsWith('/server-info')
    ) {
      return new Response('Not Found', { status: 404 });
    }

    const response = await env.ASSETS.fetch(request);
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

    // Structured JSON log for Cloudflare Workers Logpush / Observability
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'proto-edge-worker',
        rayId,
        method: request.method,
        path: url.pathname,
        status: response.status,
        durationMs,
        clientIp: request.headers.get('cf-connecting-ip') || 'unknown',
      }),
    );

    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    newHeaders.set('x-request-id', rayId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
