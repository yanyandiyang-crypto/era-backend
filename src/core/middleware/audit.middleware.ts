import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from '../../features/audit/audit.service';
import { AuditAction } from '../../features/audit/audit.types';
import { prisma } from '../../config/database';

/**
 * Audit Logging Middleware
 * Logs all API requests for audit trail
 */
export async function auditLoggingMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  // Skip logging for health checks and static files
  if (request.url === '/health' || request.url.startsWith('/uploads/')) {
    return;
  }

  // Get user info from request if authenticated
  const userId = (request as any).user?.id;
  const userEmail = (request as any).user?.email;

  // Log the request
  const auditService = new AuditService(prisma);
  await auditService.createLog({
    userId,
    action: AuditAction.UNAUTHORIZED_ACCESS, // This will be overridden by specific actions
    resourceType: 'API_REQUEST',
    resourceId: request.url,
    details: {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      email: userEmail,
    },
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] as string,
  });

  // Continue with the request
}