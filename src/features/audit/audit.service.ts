import { PrismaClient } from '@prisma/client';
import { CreateAuditLogDTO, AuditLogQuery, AuditLogResponse } from './audit.types';
import { CONSTANTS } from '../../config/constants';
import { PaginatedResponse } from '../../types';

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  async createLog(data: CreateAuditLogDTO): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      // Don't throw errors from audit logging
      // Just log to console and continue
      // console.error('Failed to create audit log:', error);
    }
  }

  async getLogs(query: AuditLogQuery): Promise<PaginatedResponse<AuditLogResponse>> {
    const page = query.page || 1;
    const limit = query.limit || CONSTANTS.DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    if (query.fromDate || query.toDate) {
      where.timestamp = {};
      if (query.fromDate) {
        where.timestamp.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.timestamp.lte = new Date(query.toDate);
      }
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    return {
      data: logs as AuditLogResponse[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLogById(id: string): Promise<AuditLogResponse | null> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return log as AuditLogResponse | null;
  }

  async getStats() {
    const [
      total,
      last24Hours,
      byAction,
      byResourceType,
      topUsers,
    ] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: true,
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['resourceType'],
        _count: true,
        orderBy: {
          _count: {
            resourceType: 'desc',
          },
        },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        _count: true,
        where: {
          userId: { not: null },
        },
        orderBy: {
          _count: {
            userId: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    // Get user details for top users
    const userIds = topUsers.map((u) => u.userId).filter((id): id is string => id !== null);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    const usersMap = new Map(users.map((u) => [u.id, u]));

    return {
      total,
      last24Hours,
      byAction: byAction.map((a) => ({
        action: a.action,
        count: a._count,
      })),
      byResourceType: byResourceType.map((r) => ({
        resourceType: r.resourceType,
        count: r._count,
      })),
      topUsers: topUsers.map((u) => ({
        user: usersMap.get(u.userId!),
        count: u._count,
      })),
    };
  }

  async getUserActivity(userId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [logs, totalActions, byAction] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          userId,
          timestamp: { gte: since },
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
      }),
      this.prisma.auditLog.count({
        where: {
          userId,
          timestamp: { gte: since },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          userId,
          timestamp: { gte: since },
        },
        _count: true,
      }),
    ]);

    return {
      userId,
      period: `last${days}Days`,
      totalActions,
      byAction: byAction.map((a) => ({
        action: a.action,
        count: a._count,
      })),
      recentLogs: logs,
    };
  }

  async getResourceActivity(resourceType: string, resourceId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        resourceType,
        resourceId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return logs;
  }

  async getSecurityEvents(days: number = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const securityActions = [
      'LOGIN_FAILED',
      'UNAUTHORIZED_ACCESS',
      'PASSWORD_CHANGED',
      'SYSTEM_ERROR',
    ];

    const events = await this.prisma.auditLog.findMany({
      where: {
        action: { in: securityActions },
        timestamp: { gte: since },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    const summary = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        action: { in: securityActions },
        timestamp: { gte: since },
      },
      _count: true,
    });

    return {
      period: `last${days}Days`,
      events,
      summary: summary.map((s) => ({
        action: s.action,
        count: s._count,
      })),
    };
  }
}
