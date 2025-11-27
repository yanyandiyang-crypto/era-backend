import { preHandlerHookHandler } from 'fastify';
import { RateLimitTier, tierToOptions } from '../../features/rate-limit/rate-limit.config';

/**
 * Create a rate limit middleware for specific routes
 * This allows overriding the global rate limit with custom limits
 */
export function createRateLimitMiddleware(_tier: RateLimitTier): preHandlerHookHandler {
  return async (_request, _reply) => {
    // The actual rate limiting is handled by the @fastify/rate-limit plugin
    // This middleware is mainly for documentation and custom tier handling
    // The route-specific config should be set in the route definition
  };
}

/**
 * Rate limit configuration for specific routes
 */
export const rateLimitConfig = (tier: RateLimitTier) => ({
  config: {
    rateLimit: tierToOptions(tier),
  },
});
