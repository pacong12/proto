/* eslint-disable no-undef */
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Proxy /api requests directly to backend API container (proto-api:3001 or localhost:3001)
    if (url.pathname.startsWith('/api')) {
      const targetHost = process.env.API_HOST || 'proto-api:3001';
      const targetUrl = `http://${targetHost}${url.pathname}${url.search}`;
      try {
        const proxyReq = new Request(targetUrl, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });
        return await fetch(proxyReq);
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'GATEWAY_ERROR', message: 'API Gateway connection failed' },
            timestamp: Date.now(),
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // Serve static files from ./dist
    const filePath = './dist' + url.pathname;
    let file = Bun.file(filePath);

    // If file doesn't exist or is a directory, fallback to SPA index.html
    if (!(await file.exists()) || (!url.pathname.includes('.') && url.pathname !== '/')) {
      file = Bun.file('./dist/index.html');
    }

    return new Response(file);
  },
});

console.info(`Frontoffice & API Proxy server running at http://localhost:${server.port}`);
