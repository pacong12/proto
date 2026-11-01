import { isAddress } from '@goton/shared-types';

/**
 * Base Application Error for Goton API.
 * Carries an error code and HTTP status code for unified presentation mapping.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', code = 'VALIDATION_ERROR') {
    super(code, message, 400);
    this.name = 'ValidationError';
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload exceeds maximum allowed size') {
    super('PAYLOAD_TOO_LARGE', message, 413);
    this.name = 'PayloadTooLargeError';
  }
}

export class RateLimitExceededError extends AppError {
  constructor(message = 'Too many requests, please slow down.') {
    super('RATE_LIMIT_EXCEEDED', message, 429);
    this.name = 'RateLimitExceededError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

/** Throws INVALID_ADDRESS unless `value` is a 0x-prefixed 20-byte hex address. */
export function assertAddress(
  value: string,
  label = 'Token address',
): asserts value is `0x${string}` {
  if (!isAddress(value)) {
    throw new ValidationError(
      `${label} must be a valid 42-character hex string`,
      'INVALID_ADDRESS',
    );
  }
}
