import { LoggerPort, LogContext, LogLevel, StructuredLogEntry } from '../domain/ports/logger.port';

export class StructuredLoggerService implements LoggerPort {
  private readonly serviceName: string;
  private readonly isTest: boolean;

  constructor(serviceName = 'proto-api', isTest?: boolean) {
    this.serviceName = serviceName;
    this.isTest = isTest ?? process.env.NODE_ENV === 'test';
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    // In automated testing, skip stdout spam unless DEBUG is explicitly set
    if (this.isTest && !process.env.DEBUG) {
      return;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...(context && Object.keys(context).length > 0 ? { context } : {}),
    };

    const output = JSON.stringify(entry);

    if (level === 'error') {
      process.stderr.write(`${output}\n`);
    } else {
      process.stdout.write(`${output}\n`);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.write('debug', message, context);
    }
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }
}

export const logger = new StructuredLoggerService();
