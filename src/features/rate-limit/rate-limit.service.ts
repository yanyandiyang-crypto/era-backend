import { FastifyInstance } from 'fastify';
import { RateLimitTiers } from './rate-limit.config';

export class RateLimitService {
  constructor(private app: FastifyInstance) {}

  /**
   * Get current rate limit status for a client
   */
  async getRateLimitStatus(ip: string) {
    // This is a placeholder - actual implementation would query the rate limiter
    return {
      ip,
      limits: {
        global: {
          max: RateLimitTiers.GLOBAL.max,
          timeWindow: RateLimitTiers.GLOBAL.timeWindow,
          current: 0, // Would be fetched from rate limiter cache
          remaining: RateLimitTiers.GLOBAL.max,
          resetAt: new Date(Date.now() + 60000),
        },
      },
    };
  }

  /**
   * Get all rate limit tiers
   */
  getRateLimitTiers() {
    return Object.entries(RateLimitTiers).map(([key, tier]) => ({
      key,
      name: tier.name,
      max: tier.max,
      timeWindow: tier.timeWindow,
      description: this.getTierDescription(key),
    }));
  }

  /**
   * Get tier descriptions
   */
  private getTierDescription(tierKey: string): string {
    const descriptions: { [key: string]: string } = {
      GLOBAL: 'Default rate limit for all endpoints',
      AUTH_LOGIN: 'Login and authentication attempts',
      PUBLIC: 'Public endpoints accessible without authentication',
      READ: 'Read operations (GET requests)',
      WRITE: 'Write operations (POST, PUT, DELETE requests)',
      UPLOAD: 'File upload endpoints',
      SEARCH: 'Search and query operations',
      REPORTS: 'Report generation endpoints',
      NOTIFICATIONS: 'Notification sending endpoints',
      EMERGENCY: 'Emergency incident reporting endpoints',
    };

    return descriptions[tierKey] || 'Custom rate limit tier';
  }

  /**
   * Check if rate limiting is enabled
   */
  isEnabled(): boolean {
    return true; // Rate limiting is always enabled
  }

  /**
   * Get rate limit statistics
   */
  getStatistics() {
    return {
      enabled: this.isEnabled(),
      totalTiers: Object.keys(RateLimitTiers).length,
      globalLimit: RateLimitTiers.GLOBAL.max,
      strictestLimit: Math.min(
        ...Object.values(RateLimitTiers).map((tier) => tier.max)
      ),
      mostPermissiveLimit: Math.max(
        ...Object.values(RateLimitTiers).map((tier) => tier.max)
      ),
    };
  }
}
