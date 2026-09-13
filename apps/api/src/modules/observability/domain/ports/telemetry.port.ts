export interface RequestMetricEntry {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  query: string;
  status: number;
  durationMs: number;
  ip: string;
  userAgent: string;
}

export interface ErrorMetricEntry {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  message: string;
  stack?: string;
  ip: string;
}

export interface SystemTelemetry {
  service: string;
  uptimeSeconds: number;
  timestamp: number;
  cache?: {
    type: string;
    available: boolean;
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  traffic: {
    totalRequests: number;
    activeRequestsPerMinute: number;
    avgLatencyMs: number;
    statusCounts: {
      '2xx': number;
      '3xx': number;
      '4xx': number;
      '5xx': number;
    };
  };
  recentRequests: RequestMetricEntry[];
  recentErrors: ErrorMetricEntry[];
}
