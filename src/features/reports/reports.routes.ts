import { FastifyInstance } from 'fastify';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { GenerateReportDTO } from './reports.types';
import { prisma } from '../../config/database';
import { validate, authMiddleware, requireRole } from '../../core/middleware';
import { generateReportSchema } from './reports.schema';

export async function reportsRoutes(app: FastifyInstance) {
  const reportsService = new ReportsService(prisma);
  const reportsController = new ReportsController(reportsService);

  // All routes require authentication and admin role
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireRole('ADMIN', 'SUPER_ADMIN'));

  // General report generation (with body)
  app.post<{ Body: GenerateReportDTO }>(
    '/generate',
    {
      preHandler: [validate(generateReportSchema)],
    },
    reportsController.generateReport.bind(reportsController)
  );

  // Convenience endpoints for common reports
  app.get(
    '/incident/:id',
    reportsController.generateIncidentReport.bind(reportsController)
  );

  app.get(
    '/incidents/summary',
    reportsController.generateIncidentSummary.bind(reportsController)
  );

  app.get(
    '/personnel',
    reportsController.generatePersonnelReport.bind(reportsController)
  );

  app.get(
    '/barangays',
    reportsController.generateBarangayReport.bind(reportsController)
  );

  app.get(
    '/statistics',
    reportsController.generateStatisticsReport.bind(reportsController)
  );

  app.get(
    '/activity',
    reportsController.generateActivityReport.bind(reportsController)
  );

  // Excel export endpoints
  app.post<{ Body: GenerateReportDTO }>(
    '/excel/generate',
    {
      preHandler: [validate(generateReportSchema)],
    },
    reportsController.generateExcelReport.bind(reportsController)
  );

  app.get(
    '/excel/incidents/summary',
    reportsController.generateIncidentSummaryExcel.bind(reportsController)
  );

  app.get(
    '/excel/personnel',
    reportsController.generatePersonnelReportExcel.bind(reportsController)
  );

  app.get(
    '/excel/barangays',
    reportsController.generateBarangayReportExcel.bind(reportsController)
  );

  app.get(
    '/excel/statistics',
    reportsController.generateStatisticsReportExcel.bind(reportsController)
  );

  // Email report endpoint
  app.post(
    '/email',
    reportsController.emailReport.bind(reportsController)
  );
}
