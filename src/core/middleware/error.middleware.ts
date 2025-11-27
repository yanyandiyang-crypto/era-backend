import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors';
import { logger } from '../utils/logger';
import { env } from '../../config/environment';
import { randomBytes } from 'crypto';

// OWASP A05/V7.4.1: Error code mapping to prevent information disclosure
const ERROR_CODES = {
  VALIDATION_ERROR: 'ERR_VALIDATION_001',
  UNAUTHORIZED: 'ERR_AUTH_002',
  FORBIDDEN: 'ERR_AUTH_003',
  NOT_FOUND: 'ERR_NOTFOUND_004',
  CONFLICT: 'ERR_CONFLICT_005',
  RATE_LIMIT: 'ERR_RATELIMIT_006',
  INTERNAL: 'ERR_INTERNAL_500',
};

function getErrorCode(error: FastifyError | AppError): string {
  if (error instanceof AppError) {
    if (error.statusCode === 400) return ERROR_CODES.VALIDATION_ERROR;
    if (error.statusCode === 401) return ERROR_CODES.UNAUTHORIZED;
    if (error.statusCode === 403) return ERROR_CODES.FORBIDDEN;
    if (error.statusCode === 404) return ERROR_CODES.NOT_FOUND;
    if (error.statusCode === 409) return ERROR_CODES.CONFLICT;
    if (error.statusCode === 429) return ERROR_CODES.RATE_LIMIT;
  }
  return ERROR_CODES.INTERNAL;
}

function getGenericMessage(error: AppError): string {
  if (error.statusCode === 400) return 'The request could not be processed due to invalid input';
  if (error.statusCode === 401) return 'Authentication is required to access this resource';
  if (error.statusCode === 403) return 'You do not have permission to access this resource';
  if (error.statusCode === 404) return 'The requested resource was not found';
  if (error.statusCode === 409) return 'The request conflicts with the current state';
  if (error.statusCode === 429) return 'Too many requests. Please try again later';
  return 'An unexpected error occurred. Please try again later';
}

export async function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // OWASP A09/V7.1.2: Generate correlation ID for error tracking
  const correlationId = randomBytes(16).toString('hex');
  const isProduction = env.NODE_ENV === 'production';

  // Log full error details server-side with correlation ID
  logger.error('Error occurred:', {
    correlationId,
    errorCode: getErrorCode(error),
    message: error.message,
    stack: error.stack,
    path: request.url,
    method: request.method,
    userId: (request.user as any)?.userId,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  });

  // Handle AppError (operational errors)
  if (error instanceof AppError) {
    const response: any = {
      success: false,
      error: {
        code: getErrorCode(error),
        message: isProduction ? getGenericMessage(error) : error.message,
        statusCode: error.statusCode,
        correlationId,
      },
    };

    // Include validation errors only in development
    if ('errors' in error && error.errors && !isProduction) {
      response.error.details = error.errors;
    }

    return reply.status(error.statusCode).send(response);
  }

  // Handle Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: isProduction ? 'Validation failed' : 'Validation failed',
        statusCode: 400,
        correlationId,
        details: isProduction ? undefined : error.validation,
      },
    });
  }

  // Handle unknown errors - never expose internal details in production
  return reply.status(500).send({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL,
      message: 'An unexpected error occurred. Please contact support with the correlation ID.',
      statusCode: 500,
      correlationId,
    },
  });
}
