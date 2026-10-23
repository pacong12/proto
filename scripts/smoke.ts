/**
 * Post-deploy smoke and sanity checks against a live environment.
 *
 *   bun run scripts/smoke.ts                       # production (goton.fun)
 *   SMOKE_ENV=development bun run scripts/smoke.ts # workers.dev development deploy
 *
 * Overrides: APP_URL, DOCS_URL, API_URL. Exits 1 when any check fails.
 */

interface Target {
  app: string;
  docs: string;
  api: string;
  /** Development deploys must stay out of search results. */
  expectNoindex: boolean;
}

const ENVIRONMENTS: Record<string, Target> = {
  production: {
    app: 'https://goton.fun',
    docs: 'https://docs.goton.fun',
    api: 'https://api.goton.cloud',
    expectNoindex: false,
  },
  development: {
    app: 'https://proto-dev.mutingudin12.workers.dev',
    docs: 'https://proto-docs-dev.mutingudin12.workers.dev',
    api: 'https://api.goton.cloud',
    expectNoindex: true,
  },
};

const envName = process.env.SMOKE_ENV ?? 'production';
const base = ENVIRONMENTS[envName];
if (!base) {
  console.error(`Unknown SMOKE_ENV "${envName}" (use production or development)`);
  process.exit(2);
}
const target: Target = {
  ...base,
  app: process.env.APP_URL ?? base.app,
  docs: process.env.DOCS_URL ?? base.docs,
  api: process.env.API_URL ?? base.api,
};

type Check = { name: string; run: () => Promise<void> };
const checks: Check[] = [];
const check = (name: string, run: () => Promise<void>) => checks.push({ name, run });

async function get(url: string): Promise<Response> {
  return fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'goton-smoke/1.0' },
  });
}
function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function expectStatus(url: string, status: number): Promise<Response> {
  const res = await get(url);
  expect(res.status === status, `${url} -> ${res.status}, expected ${status}`);
  return res;
}

// --- App (edge worker + static frontoffice) ---
check('app: home page renders', async () => {
  const res = await expectStatus(`${target.app}/`, 200);
  expect((await res.text()).includes('<title>'), 'no <title> in HTML');
});
check('app: SPA route launchpad', async () => {
  await expectStatus(`${target.app}/launchpad`, 200);
});
check('app: security headers', async () => {
  const res = await get(`${target.app}/`);
  expect(res.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options missing');
  expect(res.headers.get('x-content-type-options') === 'nosniff', 'nosniff missing');
  expect(res.headers.get('strict-transport-security'), 'HSTS missing');
  const csp =
    res.headers.get('content-security-policy') ??
    res.headers.get('content-security-policy-report-only');
  expect(csp?.includes("frame-ancestors 'none'"), 'CSP missing');
});
check(`app: indexing (${target.expectNoindex ? 'noindex' : 'indexable'})`, async () => {
  const tag = (await get(`${target.app}/`)).headers.get('x-robots-tag') ?? '';
  expect(
    target.expectNoindex ? tag.includes('noindex') : !tag.includes('noindex'),
    `X-Robots-Tag "${tag}"`,
  );
});
check('app: API proxy and health', async () => {
  const res = await expectStatus(`${target.app}/health`, 200);
  expect(((await res.json()) as { status?: string }).status === 'ok', 'health status not ok');
});
check('app: token list via API proxy', async () => {
  const res = await expectStatus(`${target.app}/api/tokens?limit=1`, 200);
  expect(((await res.json()) as { success?: boolean }).success === true, 'success !== true');
});
check('app: maintenance status endpoint', async () => {
  const res = await expectStatus(`${target.app}/site-status.json`, 200);
  const body = (await res.json()) as { maintenance?: string };
  expect(['off', 'banner', 'full'].includes(body.maintenance ?? ''), 'unexpected maintenance');
  if (body.maintenance !== 'off') console.warn(`  note: maintenance mode is ${body.maintenance}`);
});
check('app: robots.txt and sitemap use the app domain', async () => {
  const robots = await (await expectStatus(`${target.app}/robots.txt`, 200)).text();
  expect(robots.includes(`Sitemap: ${target.app}/sitemap.xml`), 'robots.txt sitemap URL');
  const sitemap = await (await expectStatus(`${target.app}/sitemap.xml`, 200)).text();
  expect(sitemap.includes('<urlset') && !sitemap.includes('%APP_URL%'), 'sitemap not rendered');
});
check('app: security.txt', async () => {
  const text = await (await expectStatus(`${target.app}/.well-known/security.txt`, 200)).text();
  expect(text.includes('Contact:') && text.includes('Expires:'), 'security.txt fields');
});
check('app: legal pages redirect to docs', async () => {
  const res = await expectStatus(`${target.app}/terms`, 301);
  expect(
    res.headers.get('location') === `${target.docs}/terms-of-service`,
    `location ${res.headers.get('location')}`,
  );
});
check('app: dotfiles are blocked', async () => {
  await expectStatus(`${target.app}/.env`, 404);
});

// --- Docs ---
check('docs: home page renders', async () => {
  const res = await expectStatus(`${target.docs}/`, 200);
  expect((await res.text()).includes('<title>'), 'no <title> in HTML');
});
check('docs: legal pages', async () => {
  for (const page of ['terms-of-service', 'privacy-policy', 'cookie-policy']) {
    await expectStatus(`${target.docs}/${page}`, 200);
  }
});
check('docs: security.txt', async () => {
  const text = await (await expectStatus(`${target.docs}/.well-known/security.txt`, 200)).text();
  expect(text.includes('Contact:'), 'security.txt fields');
});
check('docs: sitemap uses the docs domain', async () => {
  const sitemap = await (await expectStatus(`${target.docs}/sitemap.xml`, 200)).text();
  expect(sitemap.includes(`<loc>${target.docs}/`), 'sitemap host');
});

// --- API (direct) ---
check('api: health', async () => {
  await expectStatus(`${target.api}/health`, 200);
});

// --- Monitoring: indexer freshness and keeper gas ---
const CHAINS = [
  { slug: 'robinhood', rpc: 'https://rpc.mainnet.chain.robinhood.com', maxLagBlocks: 2_400 }, // ~10 min
  { slug: 'arc', rpc: 'https://rpc.mainnet.arc.io', maxLagBlocks: 1_200 }, // ~10 min
];
async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  return ((await res.json()) as { result: T }).result;
}
for (const chain of CHAINS) {
  check(`api: ${chain.slug} indexer is current`, async () => {
    const res = await expectStatus(`${target.api}/dex/latest-block?chain=${chain.slug}`, 200);
    const indexed = ((await res.json()) as { block: number }).block;
    const head = Number(BigInt(await rpc<string>(chain.rpc, 'eth_blockNumber', [])));
    expect(head - indexed <= chain.maxLagBlocks, `indexer ${head - indexed} blocks behind head`);
  });
}
// SMOKE_KEEPER_ADDRESS: the keeper's public address; it must keep enough gas to run.
const keeper = process.env.SMOKE_KEEPER_ADDRESS;
if (keeper) {
  const minGas = [
    { slug: 'robinhood', rpc: CHAINS[0].rpc, min: 2n * 10n ** 14n, unit: 'ETH' }, // 0.0002 ETH
    { slug: 'arc', rpc: CHAINS[1].rpc, min: 2n * 10n ** 17n, unit: 'USDC' }, // 0.2 USDC (18 dp native)
  ];
  for (const g of minGas) {
    check(`keeper: ${g.slug} gas balance`, async () => {
      const bal = BigInt(await rpc<string>(g.rpc, 'eth_getBalance', [keeper, 'latest']));
      expect(bal >= g.min, `${Number(bal) / 1e18} ${g.unit} left, top up ${keeper}`);
    });
  }
}

console.log(`Smoke checks for ${envName}: ${target.app} | ${target.docs} | ${target.api}\n`);
let failed = 0;
for (const { name, run } of checks) {
  try {
    await run();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}: ${(e as Error).message}`);
  }
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed > 0 ? 1 : 0);
