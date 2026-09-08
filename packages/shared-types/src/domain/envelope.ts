export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
  timestamp: number;
}

export function ok<T>(data: T): ApiEnvelope<T> {
  return {
    success: true,
    data,
    error: null,
    timestamp: Date.now(),
  };
}

export function err<T = null>(code: string, message: string, details?: unknown): ApiEnvelope<T> {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
    timestamp: Date.now(),
  };
}
