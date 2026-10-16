import autocannon from 'autocannon';

/**
 * Load and stress test harness for the Proto API server.
 * Validates latency, throughput, and Redis cache efficiency across all
 * critical read endpoints, not just /health (fix LOW-04).
 */

interface BenchResult {
  endpoint: string;
  totalRequests: number;
  avgRps: number;
  p50Ms: number;
  p99Ms: number;
  errors: number;
  /** Responses with 5xx status or 429 (rate limited): both count as failures. */
  failedResponses: number;
  passed: boolean;
}

/** SLA thresholds that every endpoint must meet. */
const SLA = {
  maxP99Ms: 500,
  maxErrors: 0,
};

const CONNECTIONS = Number(process.env.LOAD_CONNECTIONS ?? 20);
const DURATION_S = Number(process.env.LOAD_DURATION ?? 5);

/** A random client IP per request, so the per-IP rate limiter sees many clients (needs TRUST_PROXY=true). */
function randomClientIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

async function bench(url: string): Promise<BenchResult> {
  const result = await autocannon({
    url,
    connections: CONNECTIONS,
    duration: DURATION_S,
    pipelining: 1,
    headers: { 'content-type': 'application/json' },
    requests: [
      {
        setupRequest: (req) => ({
          ...req,
          headers: { ...(req.headers ?? {}), 'x-real-ip': randomClientIp() },
        }),
      },
    ],
  });

  const codes =
    (result as unknown as { statusCodeStats?: Record<string, { count: number }> })
      .statusCodeStats ?? {};
  const failedResponses = Object.entries(codes)
    .filter(([code]) => code === '429' || code.startsWith('5'))
    .reduce((sum, [, stat]) => sum + stat.count, 0);

  return {
    endpoint: url,
    totalRequests: result.requests.total,
    avgRps: result.requests.average,
    p50Ms: result.latency.p50,
    p99Ms: result.latency.p99,
    errors: result.errors,
    failedResponses,
    passed:
      result.errors <= SLA.maxErrors && failedResponses === 0 && result.latency.p99 <= SLA.maxP99Ms,
  };
}

function printResult(r: BenchResult) {
  const status = r.passed ? 'PASS' : 'FAIL';
  console.log(`\n[${status}] ${r.endpoint}`);
  console.log(`  Total Requests : ${r.totalRequests}`);
  console.log(`  Throughput RPS : ${r.avgRps}`);
  console.log(`  P50 Latency    : ${r.p50Ms}ms`);
  console.log(`  P99 Latency    : ${r.p99Ms}ms  (SLA: <=${SLA.maxP99Ms}ms)`);
  console.log(`  Errors         : ${r.errors}`);
  console.log(`  5xx / 429      : ${r.failedResponses}`);
}

async function runLoadBenchmark() {
  const baseUrl = process.env.API_URL || 'http://127.0.0.1:3001';
  console.log(`\n[LoadTest] Target: ${baseUrl}`);
  console.log('='.repeat(60));

  /**
   * Endpoints under test.
   * Covers the heaviest read paths, not just the health check (fix LOW-04).
   * The per-token endpoints use a known address; the server should return
   * 200 or 404, never an unhandled crash.
   */
  const targets = [
    `${baseUrl}/health`,
    `${baseUrl}/api/tokens?limit=20`,
    `${baseUrl}/api/tokens?limit=20&sort=volume`,
    `${baseUrl}/api/analytics`,
    `${baseUrl}/api/tokens/0xbA42499Cfe59abc05120A100EEc4f859F476034F`,
    `${baseUrl}/api/tokens/0xbA42499Cfe59abc05120A100EEc4f859F476034F/trades?limit=50`,
    `${baseUrl}/api/tokens/0xbA42499Cfe59abc05120A100EEc4f859F476034F/ohlcv?resolution=60`,
  ];

  const results: BenchResult[] = [];
  for (const url of targets) {
    process.stdout.write(`  Benchmarking ${url} ...`);
    const r = await bench(url);
    results.push(r);
    printResult(r);
  }

  const failed = results.filter((r) => !r.passed);
  console.log('\n' + '='.repeat(60));
  console.log(`SUMMARY: ${results.length - failed.length}/${results.length} endpoints passed`);

  if (failed.length > 0) {
    console.error('\n[LoadTest] SLA violations:');
    for (const r of failed) {
      if (r.errors > SLA.maxErrors) {
        console.error(`  ERROR: ${r.endpoint} had ${r.errors} connection error(s)`);
      }
      if (r.failedResponses > 0) {
        console.error(
          `  FAIL:  ${r.endpoint} answered ${r.failedResponses} request(s) with 5xx/429`,
        );
      }
      if (r.p99Ms > SLA.maxP99Ms) {
        console.error(`  SLOW:  ${r.endpoint} P99=${r.p99Ms}ms > ${SLA.maxP99Ms}ms`);
      }
    }
    process.exit(1);
  }

  console.log('[LoadTest] All SLA thresholds met.\n');
}

runLoadBenchmark().catch((err) => {
  console.error('[LoadTest] Execution failed:', err);
  process.exit(1);
});
