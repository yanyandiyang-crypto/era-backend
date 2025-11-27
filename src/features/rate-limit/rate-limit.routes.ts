import { FastifyInstance } from 'fastify';
import { RateLimitController } from './rate-limit.controller';
import { RateLimitService } from './rate-limit.service';
import { authMiddleware, requireRole } from '../../core/middleware';

export async function rateLimitRoutes(app: FastifyInstance) {
  const rateLimitService = new RateLimitService(app);
  const rateLimitController = new RateLimitController(rateLimitService);

  // Get current rate limit status (authenticated users)
  app.get(
    '/status',
    { preHandler: authMiddleware },
    rateLimitController.getRateLimitStatus.bind(rateLimitController)
  );

  // Get all rate limit tiers (admin only)
  app.get(
    '/tiers',
    { preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')] },
    rateLimitController.getRateLimitTiers.bind(rateLimitController)
  );

  // Get rate limit statistics (admin only)
  app.get(
    '/statistics',
    { preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')] },
    rateLimitController.getRateLimitStatistics.bind(rateLimitController)
  );
}
