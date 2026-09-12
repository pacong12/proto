import { HttpRequestTracker } from './http-request-tracker';

export class DevopsController {
  constructor(private readonly tracker: HttpRequestTracker) {}

  getTelemetry() {
    return {
      success: true,
      data: this.tracker.getTelemetry(),
      timestamp: Date.now(),
    };
  }

  getPrometheusMetrics(): string {
    const t = this.tracker.getTelemetry();
    const lines: string[] = [
      '# HELP process_uptime_seconds Total process uptime in seconds',
      '# TYPE process_uptime_seconds counter',
      `process_uptime_seconds ${t.uptimeSeconds}`,
      '',
      '# HELP process_resident_memory_bytes Resident memory size in bytes',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${t.memory.rssMb * 1024 * 1024}`,
      '',
      '# HELP process_heap_used_bytes Heap memory used in bytes',
      '# TYPE process_heap_used_bytes gauge',
      `process_heap_used_bytes ${t.memory.heapUsedMb * 1024 * 1024}`,
      '',
      '# HELP http_requests_total Total number of HTTP requests processed',
      '# TYPE http_requests_total counter',
      `http_requests_total{status="2xx"} ${t.traffic.statusCounts['2xx']}`,
      `http_requests_total{status="3xx"} ${t.traffic.statusCounts['3xx']}`,
      `http_requests_total{status="4xx"} ${t.traffic.statusCounts['4xx']}`,
      `http_requests_total{status="5xx"} ${t.traffic.statusCounts['5xx']}`,
      '',
      '# HELP http_request_duration_avg_ms Average request latency in milliseconds',
      '# TYPE http_request_duration_avg_ms gauge',
      `http_request_duration_avg_ms ${t.traffic.avgLatencyMs}`,
      '',
      '# HELP http_requests_per_minute Active requests in the rolling 60-second window',
      '# TYPE http_requests_per_minute gauge',
      `http_requests_per_minute ${t.traffic.activeRequestsPerMinute}`,
    ];

    return lines.join('\n') + '\n';
  }

  getDashboardHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proto DevOps · Observability & Request Tracking</title>
  <style>
    :root {
      --bg: #121212;
      --card: #1a1a1a;
      --border: #292929;
      --text: #ececec;
      --muted: #888888;
      --green: #10b981;
      --yellow: #f59e0b;
      --red: #ef4444;
      --blue: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: "Charter", "Georgia", serif;
      padding: 24px;
      line-height: 1.5;
    }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .status-badge {
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.15);
      color: var(--green);
      border: 1px solid rgba(16, 185, 129, 0.3);
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .card .label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .card .value {
      font-size: 24px;
      font-weight: 700;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      margin: 24px 0 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: #151515;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    tr:hover { background: #222222; }
    .tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
    }
    .get { background: rgba(59, 130, 246, 0.2); color: var(--blue); }
    .post { background: rgba(16, 185, 129, 0.2); color: var(--green); }
    .status-2xx { color: var(--green); font-weight: 700; }
    .status-4xx { color: var(--yellow); font-weight: 700; }
    .status-5xx { color: var(--red); font-weight: 700; }
    .refresh-hint {
      font-size: 11px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Proto Protocol · DevOps Observability</h1>
      <p class="mono" style="font-size: 12px; color: var(--muted); margin-top: 4px;">Service: proto-api | Engine: Bun | Port: 3001</p>
    </div>
    <div style="display: flex; gap: 8px; align-items: center;">
      <span class="status-badge mono" id="live-indicator">LIVE POLLING (3s)</span>
    </div>
  </header>

  <div class="grid">
    <div class="card">
      <div class="label mono">Uptime</div>
      <div class="value mono" id="m-uptime">--</div>
    </div>
    <div class="card">
      <div class="label mono">Requests / Min</div>
      <div class="value mono" id="m-rpm">--</div>
    </div>
    <div class="card">
      <div class="label mono">Average Latency</div>
      <div class="value mono" id="m-latency">--</div>
    </div>
    <div class="card">
      <div class="label mono">Memory RSS / Heap</div>
      <div class="value mono" id="m-memory">--</div>
    </div>
  </div>

  <div class="grid" style="grid-template-columns: repeat(4, 1fr);">
    <div class="card">
      <div class="label mono" style="color: var(--green);">2xx Success</div>
      <div class="value mono status-2xx" id="m-2xx">0</div>
    </div>
    <div class="card">
      <div class="label mono" style="color: var(--blue);">3xx Redirect</div>
      <div class="value mono" id="m-3xx">0</div>
    </div>
    <div class="card">
      <div class="label mono" style="color: var(--yellow);">4xx Client Error</div>
      <div class="value mono status-4xx" id="m-4xx">0</div>
    </div>
    <div class="card">
      <div class="label mono" style="color: var(--red);">5xx Server Error</div>
      <div class="value mono status-5xx" id="m-5xx">0</div>
    </div>
  </div>

  <div class="section-title">
    <span>Live Request Stream (Ring Buffer: Last 100)</span>
    <span class="refresh-hint mono" id="last-updated">Updating...</span>
  </div>

  <table>
    <thead>
      <tr>
        <th class="mono">Time</th>
        <th class="mono">Method</th>
        <th class="mono">Path</th>
        <th class="mono">Status</th>
        <th class="mono">Latency</th>
        <th class="mono">Client IP</th>
        <th class="mono">Request ID</th>
      </tr>
    </thead>
    <tbody id="request-stream-body">
      <tr><td colspan="7" class="mono" style="text-align: center; color: var(--muted); padding: 20px;">Waiting for telemetry...</td></tr>
    </tbody>
  </table>

  <script>
    function formatUptime(seconds) {
      const d = Math.floor(seconds / (3600*24));
      const h = Math.floor(seconds % (3600*24) / 3600);
      const m = Math.floor(seconds % 3600 / 60);
      const s = Math.floor(seconds % 60);
      if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
      if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
      return m + 'm ' + s + 's';
    }

    async function pollTelemetry() {
      try {
        const res = await fetch('/api/devops/telemetry');
        const json = await res.json();
        if (!json.success || !json.data) return;
        const d = json.data;

        document.getElementById('m-uptime').textContent = formatUptime(d.uptimeSeconds);
        document.getElementById('m-rpm').textContent = d.traffic.activeRequestsPerMinute + ' req/m';
        document.getElementById('m-latency').textContent = d.traffic.avgLatencyMs + ' ms';
        document.getElementById('m-memory').textContent = d.memory.rssMb + 'M / ' + d.memory.heapUsedMb + 'M';

        document.getElementById('m-2xx').textContent = d.traffic.statusCounts['2xx'];
        document.getElementById('m-3xx').textContent = d.traffic.statusCounts['3xx'];
        document.getElementById('m-4xx').textContent = d.traffic.statusCounts['4xx'];
        document.getElementById('m-5xx').textContent = d.traffic.statusCounts['5xx'];

        document.getElementById('last-updated').textContent = 'Last synced: ' + new Date().toLocaleTimeString();

        const tbody = document.getElementById('request-stream-body');
        if (d.recentRequests && d.recentRequests.length > 0) {
          tbody.innerHTML = d.recentRequests.map(r => {
            const time = r.timestamp.slice(11, 19);
            const methodClass = r.method.toLowerCase();
            const statusClass = r.status >= 500 ? 'status-5xx' : r.status >= 400 ? 'status-4xx' : 'status-2xx';
            const reqShort = r.requestId ? r.requestId.slice(0, 8) + '...' : '-';
            return '<tr>' +
              '<td class="mono" style="color: var(--muted);">' + time + '</td>' +
              '<td><span class="tag mono ' + methodClass + '">' + r.method + '</span></td>' +
              '<td class="mono" style="font-weight: 600;">' + r.path + (r.query || '') + '</td>' +
              '<td class="mono ' + statusClass + '">' + r.status + '</td>' +
              '<td class="mono">' + r.durationMs + ' ms</td>' +
              '<td class="mono" style="color: var(--muted);">' + r.ip + '</td>' +
              '<td class="mono" title="' + r.requestId + '" style="color: var(--muted);">' + reqShort + '</td>' +
            '</tr>';
          }).join('');
        }
      } catch (err) {
        console.warn('Telemetry polling error:', err);
      }
    }

    pollTelemetry();
    setInterval(pollTelemetry, 3000);
  </script>
</body>
</html>`;
  }
}
