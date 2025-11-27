import { FastifyInstance } from 'fastify';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TimeRangeQuery } from './dashboard.types';
import { prisma } from '../../config/database';
import { validate, authMiddleware } from '../../core/middleware';
import { timeRangeQuerySchema } from './dashboard.schema';

export async function dashboardRoutes(app: FastifyInstance) {
  const dashboardService = new DashboardService(prisma);
  const dashboardController = new DashboardController(dashboardService);

  // All routes require authentication
  app.addHook('preHandler', authMiddleware);

  // Overview - main dashboard stats
  app.get('/overview', dashboardController.getOverview.bind(dashboardController));

  // Incident trends with time range
  app.get<{ Querystring: TimeRangeQuery }>(
    '/trends',
    {
      preHandler: [validate(timeRangeQuerySchema, 'query')],
    },
    dashboardController.getIncidentTrends.bind(dashboardController)
  );

  // Heat map data for Google Maps
  app.get('/heatmap', dashboardController.getHeatMap.bind(dashboardController));

  // Top performing barangays
  app.get('/top-barangays', dashboardController.getTopBarangays.bind(dashboardController));

  // Top performing personnel
  app.get('/top-personnel', dashboardController.getTopPersonnel.bind(dashboardController));

  // Recent activity feed
  app.get('/activity', dashboardController.getRecentActivity.bind(dashboardController));

  // Performance metrics
  app.get('/metrics', dashboardController.getPerformanceMetrics.bind(dashboardController));
}
