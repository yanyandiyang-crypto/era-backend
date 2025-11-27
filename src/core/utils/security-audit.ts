import { logger } from './logger';
import { AuditService } from '../../features/audit/audit.service';
import { AuditAction } from '../../features/audit/audit.types';
import { prisma } from '../../config/database';

export enum SecurityEventType {
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  API_ERROR = 'API_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

function mapSecurityEventToAuditAction(eventType: SecurityEventType): AuditAction {
  switch (eventType) {
    case SecurityEventType.LOGIN_FAILED:
      return AuditAction.LOGIN_FAILED;
    case SecurityEventType.LOGOUT:
      return AuditAction.LOGOUT;
    case SecurityEventType.UNAUTHORIZED_ACCESS:
      return AuditAction.UNAUTHORIZED_ACCESS;
    case SecurityEventType.LOGIN_SUCCESS:
      return AuditAction.LOGIN;
    case SecurityEventType.PASSWORD_CHANGE:
      return AuditAction.PASSWORD_CHANGED;
    default:
      return AuditAction.SYSTEM_ERROR; // fallback
  }
}

export interface SecurityAuditLog {
  eventType: SecurityEventType;
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Security Audit Logging Service
 * Logs security events for monitoring and compliance
 */
export class SecurityAuditService {
  /**
   * Log security event
   */
  static async logSecurityEvent(event: SecurityAuditLog): Promise<void> {
    try {
      // Log to console for immediate visibility
      logger.info(`[SECURITY EVENT] ${event.eventType} from ${event.ipAddress}`);

      // Store in database for audit trail
      const auditService = new AuditService(prisma);
      await auditService.createLog({
        userId: event.userId,
        action: mapSecurityEventToAuditAction(event.eventType),
        resourceType: 'SECURITY',
        resourceId: event.endpoint || 'unknown',
        details: {
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          endpoint: event.endpoint,
          method: event.method,
          statusCode: event.statusCode,
          ...event.details,
        },
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      });

      if (event.details) {
        logger.info(`Event details:`, event.details);
      }

      // Optional: Send alerts for critical events
      if (this.isCriticalEvent(event.eventType)) {
        logger.warn(`[SECURITY ALERT] Critical security event detected: ${event.eventType}`);
      }
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  /**
   * Log login attempt
   */
  static async logLoginAttempt(
    email: string,
    ipAddress: string,
    userAgent?: string,
    success: boolean = false
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: success ? SecurityEventType.LOGIN_SUCCESS : SecurityEventType.LOGIN_FAILED,
      email,
      ipAddress,
      userAgent,
      endpoint: '/api/v1/auth/login',
      method: 'POST',
      timestamp: new Date(),
    });
  }

  /**
   * Log unauthorized access attempt
   */
  static async logUnauthorizedAccess(
    ipAddress: string,
    endpoint: string,
    method: string,
    userAgent?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
      ipAddress,
      endpoint,
      method,
      userAgent,
      statusCode: 401,
      timestamp: new Date(),
    });
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(
    ipAddress: string,
    endpoint: string,
    reason: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      ipAddress,
      endpoint,
      method: 'UNKNOWN',
      details: {
        reason,
        ...details,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Log file upload event
   */
  static async logFileUpload(
userId: string, ipAddress: string, filename: string, success: boolean = true, _error: string | undefined  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: success ? SecurityEventType.FILE_UPLOAD : SecurityEventType.FILE_UPLOAD_FAILED,
      userId,
      ipAddress,
      endpoint: '/api/v1/photos/upload',
      method: 'POST',
      details: {
        filename,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Check if event is critical and requires immediate attention
   */
  private static isCriticalEvent(eventType: SecurityEventType): boolean {
    const criticalEvents = [
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      SecurityEventType.UNAUTHORIZED_ACCESS,
      SecurityEventType.RATE_LIMIT_EXCEEDED,
    ];

    return criticalEvents.includes(eventType);
  }

  /**
   * Get security events for a specific user
   */
  static async getSecurityEvents(
    userId: string,
    _limit: number = 50
  ): Promise<SecurityAuditLog[]> {
    // This would query the audit log table in a real implementation
    logger.info(`Retrieving security events for user: ${userId}`);
    return [];
  }

  /**
   * Get suspicious activities within timeframe
   */
  static async getSuspiciousActivities(
    hoursBack: number = 24
  ): Promise<SecurityAuditLog[]> {
    // This would query the audit log table in a real implementation
    logger.info(`Retrieving suspicious activities from last ${hoursBack} hours`);
    return [];
  }
}
