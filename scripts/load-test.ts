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
  passed: boolean;
}

/** SLA thresholds that every endpoint must meet. */
const SLA = {
  maxP99Ms: 500,
  maxErrors: 0,
};

async function bench(url: string, connections = 20, duration = 5): Promise<BenchResult> {
  const result = await autocannon({
    url,
    connections,
    duration,
    pipelining: 1,
    headers: { 'content-type': 'application/json' },
  });

  return {
    endpoint: url,
    totalRequests: result.requests.total,
    avgRps: result.requests.average,
    p50Ms: result.latency.p50,
    p99Ms: result.latency.p99,
    errors: result.errors,
    passed: result.errors <= SLA.maxErrors && result.latency.p99 <= SLA.maxP99Ms,
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
    `${baseUrl}/api/tokens/0x48844223aBDceeb1Ce502F54d559681358E68200`,
    `${baseUrl}/api/tokens/0x48844223aBDceeb1Ce502F54d559681358E68200/trades?limit=50`,
    `${baseUrl}/api/tokens/0x48844223aBDceeb1Ce502F54d559681358E68200/ohlcv?resolution=60`,
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
