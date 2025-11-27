import { prisma } from '../../config/database';
import { AuditAction } from '../../features/audit/audit.types';
import { FastifyRequest } from 'fastify';

export class AuditLogger {
  static async log(
    action: AuditAction,
    resourceType: string,
    userId?: string,
    resourceId?: string,
    details?: any,
    request?: FastifyRequest
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action,
          resourceType,
          resourceId: resourceId || null,
          details: details || null,
          ipAddress: request?.ip || null,
          userAgent: request?.headers['user-agent'] || null,
        },
      });
    } catch (error) {
      // Don't throw errors from audit logging
      // console.error('Failed to create audit log:', error);
    }
  }

  // Convenience methods for common actions
  static async logLogin(userId: string, success: boolean, request?: FastifyRequest) {
    await this.log(
      success ? AuditAction.LOGIN : AuditAction.LOGIN_FAILED,
      'User',
      userId,
      userId,
      { success },
      request
    );
  }

  static async logLogout(userId: string, request?: FastifyRequest) {
    await this.log(AuditAction.LOGOUT, 'User', userId, userId, undefined, request);
  }

  static async logCreate(
    resourceType: string,
    resourceId: string,
    userId: string,
    details?: any,
    request?: FastifyRequest
  ) {
    const action = `${resourceType.toUpperCase()}_CREATED` as AuditAction;
    await this.log(action, resourceType, userId, resourceId, details, request);
  }

  static async logUpdate(
    resourceType: string,
    resourceId: string,
    userId: string,
    details?: any,
    request?: FastifyRequest
  ) {
    const action = `${resourceType.toUpperCase()}_UPDATED` as AuditAction;
    await this.log(action, resourceType, userId, resourceId, details, request);
  }

  static async logDelete(
    resourceType: string,
    resourceId: string,
    userId: string,
    details?: any,
    request?: FastifyRequest
  ) {
    const action = `${resourceType.toUpperCase()}_DELETED` as AuditAction;
    await this.log(action, resourceType, userId, resourceId, details, request);
  }

  static async logUnauthorizedAccess(
    resourceType: string,
    userId?: string,
    details?: any,
    request?: FastifyRequest
  ) {
    await this.log(AuditAction.UNAUTHORIZED_ACCESS, resourceType, userId, undefined, details, request);
  }

  static async logError(error: any, userId?: string, request?: FastifyRequest) {
    await this.log(
      AuditAction.SYSTEM_ERROR,
      'System',
      userId,
      undefined,
      {
        error: error.message,
        stack: error.stack,
      },
      request
    );
  }
}
