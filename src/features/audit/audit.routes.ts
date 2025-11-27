import { FastifyInstance } from 'fastify';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLogQuery } from './audit.types';
import { prisma } from '../../config/database';
import { validate, authMiddleware, requireRole } from '../../core/middleware';
import { auditLogQuerySchema } from './audit.schema';

export async function auditRoutes(app: FastifyInstance) {
  const auditService = new AuditService(prisma);
  const auditController = new AuditController(auditService);

  // Shared middleware for all audit routes
  const adminOnly = [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')];

  // Get audit logs with filters
  app.get<{ Querystring: AuditLogQuery }>(
    '/',
    {
      preHandler: [...adminOnly, validate(auditLogQuerySchema, 'query')],
    },
    auditController.getLogs.bind(auditController)
  );

  // Get audit log by ID
  app.get<{ Params: { id: string } }>('/:id', { preHandler: adminOnly }, auditController.getLogById.bind(auditController));

  // Get audit statistics
  app.get('/stats/summary', { preHandler: adminOnly }, auditController.getStats.bind(auditController));

  // Get security events
  app.get<{ Querystring: { days?: string } }>('/security/events', { preHandler: adminOnly }, auditController.getSecurityEvents.bind(auditController));

  // Get user activity
  app.get<{ Params: { userId: string }; Querystring: { days?: string } }>('/user/:userId/activity', { preHandler: adminOnly }, auditController.getUserActivity.bind(auditController));

  // Get resource activity history
  app.get<{ Params: { resourceType: string; resourceId: string } }>(
    '/resource/:resourceType/:resourceId',
    { preHandler: adminOnly },
    auditController.getResourceActivity.bind(auditController)
  );
}
