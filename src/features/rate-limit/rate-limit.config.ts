import { RateLimitOptions } from '@fastify/rate-limit';

export interface RateLimitTier {
  name: string;
  max: number;
  timeWindow: string | number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Rate limit tiers
export const RateLimitTiers = {
  // Global default: 100 requests per minute
  GLOBAL: {
    name: 'Global',
    max: 100,
    timeWindow: '1 minute',
  } as RateLimitTier,

  // Authentication: 5 login attempts per minute
  AUTH_LOGIN: {
    name: 'Login',
    max: 5,
    timeWindow: '1 minute',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  } as RateLimitTier,

  // Public endpoints: 30 requests per minute
  PUBLIC: {
    name: 'Public',
    max: 30,
    timeWindow: '1 minute',
  } as RateLimitTier,

  // Read operations: 60 requests per minute
  READ: {
    name: 'Read',
    max: 60,
    timeWindow: '1 minute',
  } as RateLimitTier,

  // Write operations: 30 requests per minute
  WRITE: {
    name: 'Write',
    max: 30,
    timeWindow: '1 minute',
  } as RateLimitTier,

  // File uploads: 10 requests per minute
  UPLOAD: {
    name: 'Upload',
    max: 10,
    timeWindow: '1 minute',
  } as RateLimitTier,

  // Search operations: 20 requests per minute
  SEARCH: {
    name: 'Search',
    max: 20,
    timeWindow: '1 minute',
  } as RateLimitTier,

  // Reports generation: 5 requests per minute
  REPORTS: {
    name: 'Reports',
    max: 5,
    timeWindow: '1 minute',
  } as RateLimitTier,

  // Notifications: 10 requests per minute
  NOTIFICATIONS: {
    name: 'Notifications',
    max: 10,
    timeWindow: '1 minute',
  } as RateLimitTier,

  // Emergency endpoints: Higher limit - 50 requests per minute
  EMERGENCY: {
    name: 'Emergency',
    max: 50,
    timeWindow: '1 minute',
  } as RateLimitTier,
};

// Convert tier to Fastify rate limit options
export function tierToOptions(tier: RateLimitTier): Partial<RateLimitOptions> {
  return {
    max: tier.max,
    timeWindow: tier.timeWindow,
    // Note: skipSuccessfulRequests and skipFailedRequests are not in base RateLimitOptions
    // but can be used in route-specific config
  };
}

// Custom error message
export const rateLimitErrorMessage = (tier: RateLimitTier) => {
  return `Rate limit exceeded. You can make ${tier.max} requests per ${typeof tier.timeWindow === 'string' ? tier.timeWindow : tier.timeWindow + 'ms'}. Please try again later.`;
};
