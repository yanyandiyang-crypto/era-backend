import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { RateLimitTiers } from '../features/rate-limit/rate-limit.config';

export async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: RateLimitTiers.GLOBAL.max,
    timeWindow: RateLimitTiers.GLOBAL.timeWindow,
    cache: 10000, // Cache size
    allowList: ['127.0.0.1'], // Whitelist localhost for development
    redis: undefined, // Can be configured for production with Redis
    skipOnError: false,
    ban: undefined, // Can implement IP banning
    continueExceeding: true,
    enableDraftSpec: true, // Enable RateLimit-* headers
    errorResponseBuilder: (request, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. You can make ${context.max} requests per ${context.after}. Please try again later.`,
        date: Date.now(),
        expiresIn: context.ttl,
      };
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
}
