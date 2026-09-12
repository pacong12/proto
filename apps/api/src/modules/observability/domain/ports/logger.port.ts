export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext extends Record<string, unknown> {
  traceId?: string;
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  service?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: LogContext;
}

export interface LoggerPort {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
