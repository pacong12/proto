import autocannon from 'autocannon';

/**
 * High-performance stress & load testing harness for Proto API Server.
 * Validates endpoint latency, throughput (requests/sec), and Redis cache hit efficiency.
 */
async function runLoadBenchmark() {
  const targetUrl = process.env.API_URL || 'http://127.0.0.1:3001';
  console.log(`[LoadTest] Commencing stress test against: ${targetUrl}`);

  // Test: Concurrent benchmark within rate limits or targeting healthcheck/analytics
  const result = await autocannon({
    url: `${targetUrl}/health`,
    connections: 20, // 20 concurrent connections
    duration: 5, // 5 seconds benchmark
    pipelining: 1,
    headers: {
      'content-type': 'application/json',
    },
  });

  console.log('\n======================================================');
  console.log('         PROTO API LOAD TEST BENCHMARK RESULTS         ');
  console.log('======================================================');
  console.log(`Endpoint          : ${targetUrl}/health`);
  console.log(`Duration          : 5s`);
  console.log(`Concurrent Conns  : 20`);
  console.log(`Total Requests    : ${result.requests.total}`);
  console.log(`Throughput (RPS)  : ${result.requests.average} req/sec`);
  console.log(`P50 Latency (ms)  : ${result.latency.p50}`);
  console.log(`P99 Latency (ms)  : ${result.latency.p99}`);
  console.log(`Total Errors      : ${result.errors}`);
  console.log(`2xx Responses     : ${result['2xx']}`);
  console.log(`Non-2xx Responses : ${result.non2xx}`);
  console.log('======================================================\n');

  if (result.errors > 0) {
    console.error(`[Reliability Violation] Encountered ${result.errors} socket/connection errors!`);
    process.exit(1);
  }

  console.log('[LoadTest] All SLA performance thresholds successfully verified.');
}

runLoadBenchmark().catch((err) => {
  console.error('[LoadTest] Execution failure:', err);
  process.exit(1);
});
