import { PrismaClient, IncidentStatus, PersonnelStatus } from '@prisma/client';
import { DashboardOverview, IncidentTrends, HeatMapData, TimeRangeQuery } from './dashboard.types';

export class DashboardService {
  constructor(private prisma: PrismaClient) {}

  async getOverview(): Promise<DashboardOverview> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalIncidents,
      activeIncidents,
      resolvedIncidents,
      todayIncidents,
      totalPersonnel,
      activePersonnel,
      onDutyPersonnel,
      availablePersonnel,
      totalBarangays,
      activeBarangays,
      responseTimes,
    ] = await Promise.all([
      // Incidents
      this.prisma.incident.count(),
      this.prisma.incident.count({
        where: {
          status: {
            in: [IncidentStatus.REPORTED, IncidentStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.incident.count({
        where: { status: IncidentStatus.RESOLVED },
      }),
      this.prisma.incident.count({
        where: {
          reportedAt: { gte: todayStart },
        },
      }),

      // Personnel
      this.prisma.personnel.count(),
      this.prisma.personnel.count({
        where: { status: PersonnelStatus.AVAILABLE },
      }),
      this.prisma.personnel.count({
        where: { status: PersonnelStatus.ON_DUTY },
      }),
      this.prisma.personnel.count({
        where: { isAvailable: true },
      }),

      // Barangays
      this.prisma.barangay.count(),
      this.prisma.barangay.count({
        where: { isActive: true },
      }),

      // Response times
      this.getResponseTimes(),
    ]);

    return {
      incidents: {
        total: totalIncidents,
        active: activeIncidents,
        resolved: resolvedIncidents,
        today: todayIncidents,
      },
      personnel: {
        total: totalPersonnel,
        active: activePersonnel,
        onDuty: onDutyPersonnel,
        available: availablePersonnel,
      },
      barangays: {
        total: totalBarangays,
        active: activeBarangays,
      },
      responseTime: responseTimes,
    };
  }

  async getIncidentTrends(query: TimeRangeQuery): Promise<IncidentTrends> {
    const { from, to } = this.getDateRange(query);

    // Get daily counts
    const incidents = await this.prisma.incident.findMany({
      where: {
        reportedAt: {
          gte: from,
          lte: to,
        },
      },
      select: {
        reportedAt: true,
        status: true,
        type: true,
        priority: true,
      },
    });

    // Group by date
    const dailyMap = new Map<string, { count: number; resolved: number }>();
    const typeMap = new Map<string, number>();
    const priorityMap = new Map<string, number>();

    incidents.forEach((incident) => {
      const dateKey = incident.reportedAt.toISOString().split('T')[0];

      // Daily counts
      const daily = dailyMap.get(dateKey) || { count: 0, resolved: 0 };
      daily.count++;
      if (incident.status === IncidentStatus.RESOLVED) {
        daily.resolved++;
      }
      dailyMap.set(dateKey, daily);

      // Type counts
      typeMap.set(incident.type, (typeMap.get(incident.type) || 0) + 1);

      // Priority counts
      priorityMap.set(incident.priority, (priorityMap.get(incident.priority) || 0) + 1);
    });

    const total = incidents.length || 1;

    return {
      daily: Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          resolved: data.resolved,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byType: Array.from(typeMap.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / total) * 100),
      })),
      byPriority: Array.from(priorityMap.entries()).map(([priority, count]) => ({
        priority,
        count,
        percentage: Math.round((count / total) * 100),
      })),
    };
  }

  async getHeatMapData(): Promise<HeatMapData> {
    const incidents = await this.prisma.incident.findMany({
      select: {
        latitude: true,
        longitude: true,
      },
      where: {
        reportedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    // Group by rounded coordinates to create heat clusters
    const coordinateMap = new Map<string, number>();

    incidents.forEach((incident) => {
      // Round to 3 decimal places (~100m precision)
      const lat = Math.round(incident.latitude * 1000) / 1000;
      const lon = Math.round(incident.longitude * 1000) / 1000;
      const key = `${lat},${lon}`;

      coordinateMap.set(key, (coordinateMap.get(key) || 0) + 1);
    });

    return {
      coordinates: Array.from(coordinateMap.entries()).map(([coords, count]) => {
        const [lat, lon] = coords.split(',').map(Number);
        return {
          latitude: lat,
          longitude: lon,
          weight: count,
        };
      }),
    };
  }

  async getTopBarangays(limit: number = 10) {
    const barangays = await this.prisma.barangay.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        _count: {
          select: {
            incidents: true,
          },
        },
      },
      orderBy: {
        incidents: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return barangays.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      incidentCount: b._count.incidents,
    }));
  }

  async getTopPersonnel(limit: number = 10) {
    const personnel = await this.prisma.personnel.findMany({
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        role: true,
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: {
        assignments: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return personnel.map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      name: `${p.firstName} ${p.lastName}`,
      role: p.role,
      assignmentCount: p._count.assignments,
    }));
  }

  async getRecentActivity(limit: number = 20) {
    const updates = await this.prisma.incidentUpdate.findMany({
      include: {
        incident: {
          select: {
            id: true,
            incidentNumber: true,
            title: true,
            type: true,
            priority: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return updates.map((update) => ({
      id: update.id,
      message: update.message,
      updateType: update.updateType,
      createdAt: update.createdAt,
      incident: update.incident,
      user: update.user,
    }));
  }

  async getPerformanceMetrics() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalIncidents,
      resolvedIncidents,
      averageResolutionTime,
      assignedPersonnel,
    ] = await Promise.all([
      this.prisma.incident.count({
        where: {
          reportedAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.incident.count({
        where: {
          reportedAt: { gte: thirtyDaysAgo },
          status: IncidentStatus.RESOLVED,
        },
      }),
      this.calculateAverageResolutionTime(thirtyDaysAgo),
      this.prisma.incidentAssignment.count({
        where: {
          assignedAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const resolutionRate =
      totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0;

    return {
      period: 'last30Days',
      totalIncidents,
      resolvedIncidents,
      resolutionRate,
      averageResolutionMinutes: averageResolutionTime,
      totalAssignments: assignedPersonnel,
      averagePersonnelPerIncident:
        totalIncidents > 0 ? Math.round((assignedPersonnel / totalIncidents) * 10) / 10 : 0,
    };
  }

  private async getResponseTimes() {
    const incidents = await this.prisma.incident.findMany({
      where: {
        assignments: {
          some: {},
        },
      },
      include: {
        assignments: {
          orderBy: { assignedAt: 'asc' },
          take: 1,
        },
      },
      take: 100,
      orderBy: { reportedAt: 'desc' },
    });

    if (incidents.length === 0) {
      return { average: 0, fastest: 0, slowest: 0 };
    }

    const times = incidents
      .filter((i) => i.assignments.length > 0)
      .map((incident) => {
        const firstAssignment = incident.assignments[0];
        return (firstAssignment.assignedAt.getTime() - incident.reportedAt.getTime()) / (1000 * 60);
      });

    if (times.length === 0) {
      return { average: 0, fastest: 0, slowest: 0 };
    }

    return {
      average: Math.round(times.reduce((sum, t) => sum + t, 0) / times.length),
      fastest: Math.round(Math.min(...times)),
      slowest: Math.round(Math.max(...times)),
    };
  }

  private async calculateAverageResolutionTime(since: Date): Promise<number> {
    const incidents = await this.prisma.incident.findMany({
      where: {
        reportedAt: { gte: since },
        status: IncidentStatus.RESOLVED,
        resolvedAt: { not: null },
      },
      select: {
        reportedAt: true,
        resolvedAt: true,
      },
    });

    if (incidents.length === 0) return 0;

    const totalMinutes = incidents.reduce((sum, incident) => {
      const time =
        (incident.resolvedAt!.getTime() - incident.reportedAt.getTime()) / (1000 * 60);
      return sum + time;
    }, 0);

    return Math.round(totalMinutes / incidents.length);
  }

  private getDateRange(query: TimeRangeQuery): { from: Date; to: Date } {
    const now = new Date();
    let from: Date;
    const to: Date = query.to ? new Date(query.to) : now;

    if (query.from) {
      from = new Date(query.from);
    } else {
      // Default based on period
      switch (query.period) {
        case 'day':
          from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
      }
    }

    return { from, to };
  }
}
