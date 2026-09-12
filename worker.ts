interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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
    const newHeaders = new Headers(response.headers);

    // Essential security headers for Retina web applications
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
