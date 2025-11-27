/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, IncidentStatus, IncidentPriority } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../core/errors';
import {
  CreateIncidentDTO,
  UpdateIncidentDTO,
  IncidentListQuery,
  AssignPersonnelDTO,
  AddIncidentUpdateDTO,
  UpdateIncidentStatusDTO,
} from './incidents.types';
import { SubmitResolutionDTO, ConfirmResolutionDTO, UpdateResolutionDTO } from './resolution.types';
import { CONSTANTS } from '../../config/constants';
import { PaginatedResponse } from '../../types';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.types';
import { TimelineService } from './timeline.service';

export class IncidentsService {
  constructor(private prisma: PrismaClient) { }

  // Map backend incident to frontend format
  private mapIncidentForFrontend(incident: any) {
    return {
      ...incident,
      incidentId: incident.id,
      trackingNumber: incident.incidentNumber,
    };
  }

  async createIncident(data: CreateIncidentDTO, userId: string) {
    // Generate incident number
    const year = new Date().getFullYear();
    const count = await this.prisma.incident.count({
      where: {
        incidentNumber: {
          startsWith: `${CONSTANTS.INCIDENT_NUMBER_PREFIX}${year}`,
        },
      },
    });

    const incidentNumber = `${CONSTANTS.INCIDENT_NUMBER_PREFIX}${year}${String(count + 1).padStart(
      4,
      '0'
    )}`;

    // If barangayId not provided, find nearest barangay
    let barangayId = data.barangayId;
    if (!barangayId) {
      const nearestBarangay = await this.findNearestBarangay(data.latitude, data.longitude);
      barangayId = nearestBarangay?.id;
    }

    const incident = await this.prisma.incident.create({
      data: {
        ...data,
        incidentNumber,
        barangayId,
        createdById: userId,
      },
      include: {
        barangay: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create initial incident update
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId: incident.id,
        userId,
        message: 'Incident reported',
        updateType: 'INFO',
      },
    });

    return this.mapIncidentForFrontend(incident);
  }

  async getIncidents(query: IncidentListQuery): Promise<PaginatedResponse<any>> {
    const page = query.page || 1;
    const limit = query.limit || CONSTANTS.DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { incidentNumber: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.type) {
      // Handle comma-separated types
      const types = query.type.split(',').map(t => t.trim());
      where.type = types.length === 1 ? types[0] : { in: types };
    }

    if (query.priority) {
      // Handle comma-separated priorities
      const priorities = query.priority.split(',').map(p => p.trim());
      where.priority = priorities.length === 1 ? priorities[0] : { in: priorities };
    }

    if (query.status) {
      // Handle comma-separated statuses
      const statuses = query.status.split(',').map(s => s.trim());
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }

    if (query.barangayId) {
      where.barangayId = query.barangayId;
    }

    if (query.fromDate || query.toDate) {
      where.reportedAt = {};
      if (query.fromDate) {
        where.reportedAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.reportedAt.lte = new Date(query.toDate);
      }
    }

    const total = await this.prisma.incident.count({ where });

    const incidents = await this.prisma.incident.findMany({
      where,
      include: {
        barangay: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        assignments: {
          include: {
            personnel: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                role: true,
                phone: true,
                photo: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignments: true,
            photos: true,
            updates: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { reportedAt: 'desc' },
    });

    const data = incidents.map((i) => {
      // Calculate acknowledgment counts
      const totalPersonnelNotified = i._count.assignments;
      const acknowledgmentCount = i.assignments.filter(
        (a) => a.arrivedAt !== null
      ).length;
      const acknowledgmentPercentage =
        totalPersonnelNotified > 0
          ? Math.round((acknowledgmentCount / totalPersonnelNotified) * 100)
          : 0;

      return {
        ...i,
        incidentId: i.id, // Map id to incidentId for frontend compatibility
        trackingNumber: i.incidentNumber, // Map incidentNumber to trackingNumber
        assignedCount: i._count.assignments,
        photoCount: i._count.photos,
        updateCount: i._count.updates,
        totalPersonnelNotified,
        acknowledgmentCount,
        acknowledgmentPercentage,
        // Include responder information for badges and details
        responders: i.assignments.map(assignment => ({
          id: assignment.id,
          personnelId: assignment.personnelId,
          incidentId: assignment.incidentId,
          isPrimary: assignment.personnelId === i.primaryResponderId,
          acceptedAt: assignment.assignedAt,
          arrivedAt: assignment.arrivedAt,
          personnel: assignment.personnel,
        })),
        assignments: undefined, // Remove original assignments array from response
        _count: undefined,
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getIncidentById(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        barangay: {
          select: {
            id: true,
            name: true,
            code: true,
            latitude: true,
            longitude: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignments: {
          include: {
            personnel: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                role: true,
                phone: true,
                photo: true,
              },
            },
          },
        },
        photos: {
          orderBy: { uploadedAt: 'desc' },
        },
        updates: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Calculate acknowledgment counts (using arrivedAt as acknowledgment indicator)
    const totalPersonnelNotified = incident.assignments.length;
    const acknowledgmentCount = incident.assignments.filter(
      (a) => a.arrivedAt !== null
    ).length;
    const acknowledgmentPercentage =
      totalPersonnelNotified > 0
        ? Math.round((acknowledgmentCount / totalPersonnelNotified) * 100)
        : 0;

    const mappedIncident = this.mapIncidentForFrontend(incident);
    return {
      ...mappedIncident,
      totalPersonnelNotified,
      acknowledgmentCount,
      acknowledgmentPercentage,
      // Include responder information for admin interface
      responders: incident.assignments.map(assignment => ({
        id: assignment.id,
        personnelId: assignment.personnelId,
        incidentId: assignment.incidentId,
        isPrimary: assignment.personnelId === incident.primaryResponderId,
        acceptedAt: assignment.assignedAt,
        arrivedAt: assignment.arrivedAt,
        personnel: assignment.personnel,
      })),
    };
  }

  async updateIncident(id: string, data: UpdateIncidentDTO, userId: string) {
    const existing = await this.prisma.incident.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Incident not found');
    }

    const incident = await this.prisma.incident.update({
      where: { id },
      data,
      include: {
        barangay: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Create update log
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId: id,
        userId,
        message: 'Incident details updated',
        updateType: 'INFO',
      },
    });

    return this.mapIncidentForFrontend(incident);
  }

  async updateStatus(id: string, data: UpdateIncidentStatusDTO, userId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Validate status transition
    this.validateStatusTransition(incident.status, data.status);

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status: data.status,
        priority: data.priority || incident.priority, // Update priority if provided
        resolvedAt: data.status === IncidentStatus.RESOLVED ? new Date() : incident.resolvedAt,
        closedAt: data.status === IncidentStatus.CLOSED ? new Date() : incident.closedAt,
      },
      include: {
        barangay: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create status change update
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId: id,
        userId,
        message: data.notes || `Status changed to ${data.status}`,
        updateType: 'STATUS_CHANGE',
      },
    });

    return this.mapIncidentForFrontend(updated);
  }

  async assignPersonnel(id: string, data: AssignPersonnelDTO, userId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Verify all personnel exist and are available
    const personnel = await this.prisma.personnel.findMany({
      where: {
        id: { in: data.personnelIds },
        status: {
          in: ['AVAILABLE', 'ON_DUTY', 'ON_BREAK'],
        },
      },
    });

    if (personnel.length !== data.personnelIds.length) {
      throw new ValidationError('One or more personnel not found or not available');
    }

    // Remove existing assignments
    await this.prisma.incidentAssignment.deleteMany({
      where: { incidentId: id },
    });

    // Create new assignments
    const assignments = await this.prisma.incidentAssignment.createMany({
      data: data.personnelIds.map((personnelId) => ({
        incidentId: id,
        personnelId,
        assignedAt: new Date(),
      })),
    });

    // Update incident status if not already in progress
    if (incident.status === IncidentStatus.REPORTED) {
      await this.prisma.incident.update({
        where: { id },
        data: { status: IncidentStatus.IN_PROGRESS },
      });
    }

    // Create update log
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId: id,
        userId,
        message: `Assigned ${data.personnelIds.length} personnel`,
        updateType: 'PERSONNEL_ASSIGNED',
      },
    });

    return assignments;
  }

  /**
   * Join incident response (Personnel self-assignment)
   */
  async joinIncidentResponse(incidentId: string, personnelId: string) {
    // Check if incident exists and is valid for response
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        assignments: {
          include: {
            personnel: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        }
      },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Check if incident status allows new responders
    const validStatuses = ['PENDING_VERIFICATION', 'VERIFIED', 'REPORTED', 'ACKNOWLEDGED', 'DISPATCHED', 'IN_PROGRESS', 'RESPONDING', 'ARRIVED'];
    if (!validStatuses.includes(incident.status)) {
      throw new ValidationError('Cannot join response for incident with current status');
    }

    // Check if personnel exists and is available
    const personnel = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    if (!['AVAILABLE', 'ON_DUTY', 'ON_BREAK'].includes(personnel.status)) {
      throw new ValidationError('Personnel not available for response');
    }

    // Check if already assigned
    const existingAssignment = incident.assignments.find(a => a.personnelId === personnelId);
    if (existingAssignment) {
      throw new ValidationError('Personnel already responding to this incident');
    }

    // Create assignment
    const assignment = await this.prisma.incidentAssignment.create({
      data: {
        incidentId,
        personnelId,
        assignedAt: new Date(),
      },
      include: {
        personnel: {
          select: { id: true, firstName: true, lastName: true, role: true }
        }
      }
    });

    // Set primary responder if this is the first responder
    if (incident.assignments.length === 0 && !incident.primaryResponderId) {
      await this.prisma.incident.update({
        where: { id: incidentId },
        data: {
          primaryResponderId: personnelId,
          status: ['VERIFIED', 'REPORTED', 'ACKNOWLEDGED'].includes(incident.status) ? 'RESPONDING' : incident.status,
          respondingAt: new Date(),
        },
      });
    }

    // Update personnel status to RESPONDING
    await this.prisma.personnel.update({
      where: { id: personnelId },
      data: { status: 'RESPONDING' },
    });

    // Create update log
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId,
        personnelId,
        message: `${personnel.firstName} ${personnel.lastName} joined the response`,
        updateType: 'PERSONNEL_ASSIGNED',
      },
    });

    return {
      assignment,
      isPrimaryResponder: incident.assignments.length === 0,
      totalResponders: incident.assignments.length + 1,
    };
  }

  /**
   * Leave incident response (Personnel self-unassignment)
   */
  async leaveIncidentResponse(incidentId: string, personnelId: string) {
    // Find the assignment
    const assignment = await this.prisma.incidentAssignment.findUnique({
      where: {
        incidentId_personnelId: {
          incidentId,
          personnelId,
        },
      },
      include: {
        incident: true,
        personnel: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    if (!assignment) {
      throw new NotFoundError('Personnel not assigned to this incident');
    }

    // Cannot leave if incident is resolved/closed
    if (['RESOLVED', 'CLOSED'].includes(assignment.incident.status)) {
      throw new ValidationError('Cannot leave response for completed incident');
    }

    // Delete assignment
    await this.prisma.incidentAssignment.delete({
      where: {
        incidentId_personnelId: {
          incidentId,
          personnelId,
        },
      },
    });

    // Update personnel status back to ON_DUTY
    await this.prisma.personnel.update({
      where: { id: personnelId },
      data: { status: 'ON_DUTY' },
    });

    // If this was the primary responder, assign new primary responder
    if (assignment.incident.primaryResponderId === personnelId) {
      const remainingAssignments = await this.prisma.incidentAssignment.findMany({
        where: { incidentId },
        orderBy: { assignedAt: 'asc' },
        take: 1,
      });

      await this.prisma.incident.update({
        where: { id: incidentId },
        data: {
          primaryResponderId: remainingAssignments.length > 0 ? remainingAssignments[0].personnelId : null,
        },
      });
    }

    // Create update log
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId,
        personnelId,
        message: `${assignment.personnel.firstName} ${assignment.personnel.lastName} left the response`,
        updateType: 'STATUS_CHANGE',
      },
    });

    return {
      message: 'Successfully left incident response',
    };
  }

  /**
   * Get incident responders
   */
  async getIncidentResponders(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        assignments: {
          include: {
            personnel: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                status: true,
              }
            }
          },
          orderBy: { assignedAt: 'asc' }
        },
        primaryResponder: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          }
        }
      }
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    return {
      incident: {
        id: incident.id,
        incidentNumber: incident.incidentNumber,
        status: incident.status,
        primaryResponderId: incident.primaryResponderId,
      },
      primaryResponder: (incident as any).primaryResponder,
      responders: (incident as any).assignments.map((assignment: any) => ({
        assignmentId: assignment.id,
        assignedAt: assignment.assignedAt,
        arrivedAt: assignment.arrivedAt,
        isPrimary: assignment.personnelId === incident.primaryResponderId,
        personnel: assignment.personnel,
      })),
      totalResponders: (incident as any).assignments.length,
    };
  }

  async addUpdate(id: string, data: AddIncidentUpdateDTO, userId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    const update = await this.prisma.incidentUpdate.create({
      data: {
        incidentId: id,
        userId,
        message: data.message,
        updateType: data.updateType,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return update;
  }

  async deleteIncident(id: string, userId?: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assignments: true,
            photos: true,
            updates: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Can only delete if no assignments, photos, or updates (or is in REPORTED status)
    if (incident.status !== IncidentStatus.REPORTED &&
      (incident._count.assignments > 0 || incident._count.photos > 0 || incident._count.updates > 1)) {
      throw new ValidationError(
        'Cannot delete incident with assignments, photos, or updates. Please archive instead.'
      );
    }

    // OWASP A09: Audit log BEFORE deletion
    if (userId) {
      const auditService = new AuditService(this.prisma);
      await auditService.createLog({
        userId,
        action: AuditAction.INCIDENT_DELETED,
        resourceType: 'INCIDENT',
        resourceId: incident.id,
        details: {
          incidentNumber: incident.incidentNumber,
          type: incident.type,
          priority: incident.priority,
          status: incident.status,
          title: incident.title,
          deletedAt: new Date().toISOString(),
        },
      });
    }

    await this.prisma.incident.delete({
      where: { id },
    });

    return { id };
  }

  /**
   * Get detailed incident statistics for the dashboard
   * @returns IncidentStatistics object matching the frontend interface
   */
  async getIncidentStats() {
    // Get current date for calculations
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all the data we need in parallel queries
    const [
      totalIncidents,
      activeIncidents,
      resolvedIncidents,
      criticalIncidents,
      resolvedToday,
      totalPersonnel,
      availablePersonnel,
      respondingPersonnel,
      onScenePersonnel,
      offDutyPersonnel,
      statusCounts,
      responseTimeStats,
      resolutionTimeStats,
      // Add any other parallel queries here
    ] = await Promise.all([
      // Incident counts
      this.prisma.incident.count(),
      this.prisma.incident.count({
        where: {
          status: {
            notIn: ['RESOLVED', 'CLOSED', 'CANCELLED', 'SPAM'],
          },
        },
      }),
      this.prisma.incident.count({
        where: {
          status: 'RESOLVED',
        },
      }),
      this.prisma.incident.count({
        where: {
          priority: 'CRITICAL',
          status: {
            notIn: ['RESOLVED', 'CLOSED', 'CANCELLED', 'SPAM'],
          },
        },
      }),
      this.prisma.incident.count({
        where: {
          status: 'RESOLVED',
          updatedAt: {
            gte: today,
          },
        },
      }),

      // Personnel counts
      this.prisma.personnel.count(),
      this.prisma.personnel.count({
        where: {
          isAvailable: true,
        },
      }),
      this.prisma.incidentAssignment.count({
        where: {
          incident: {
            status: 'RESPONDING',
          },
          // assignedAt is always set (non-nullable in schema)
          arrivedAt: null,
        },
      }),
      this.prisma.incidentAssignment.count({
        where: {
          incident: {
            status: 'ARRIVED',
          },
          arrivedAt: { not: null },
        },
      }),
      this.prisma.personnel.count({
        where: {
          isAvailable: false,
        },
      }),

      // Status distribution for percentages
      this.prisma.incident.groupBy({
        by: ['status'],
        _count: true,
        where: {
          status: {
            in: ['PENDING_VERIFICATION', 'VERIFIED', 'RESPONDING', 'ARRIVED', 'RESOLVED'],
          },
        },
      }),

      // Response time calculations
      this.calculateAverageResponseTime(),
      this.calculateAverageResolutionTime(),
    ]);

    // Calculate percentages for status distribution
    const activeTotal = statusCounts.reduce((sum, s) => sum + s._count, 0);
    const statusPercentages = new Map();
    statusCounts.forEach((s) => {
      statusPercentages.set(s.status, activeTotal > 0 ? (s._count / activeTotal) * 100 : 0);
    });

    // Hard-code some trend metrics for now - in a real implementation you'd compare with previous period
    const activeIncidentsPercentChange = 5; // Example value
    const resolvedPercentChange = 12; // Example value
    const criticalIncidentsPercentChange = -8; // Example value
    const responseTimePercentChange = -12; // Example value

    // Return the statistics in the format expected by the frontend
    return {
      // Incident counts
      totalIncidentsCount: totalIncidents,
      activeIncidentsCount: activeIncidents,
      resolvedIncidentsCount: resolvedIncidents,
      criticalIncidentsCount: criticalIncidents,
      resolvedTodayCount: resolvedToday,

      // Personnel counts
      totalPersonnelCount: totalPersonnel,
      availablePersonnelCount: availablePersonnel,
      respondingPersonnelCount: respondingPersonnel,
      onScenePersonnelCount: onScenePersonnel,
      offDutyPersonnelCount: offDutyPersonnel,

      // Response metrics
      averageResponseTimeMinutes: responseTimeStats || 0,
      averageResolutionTimeMinutes: resolutionTimeStats || 0,

      // Distribution percentages
      pendingVerificationPercent: statusPercentages.get('PENDING_VERIFICATION') || 0,
      verifiedPercent: statusPercentages.get('VERIFIED') || 0,
      respondingPercent: statusPercentages.get('RESPONDING') || 0,
      arrivedPercent: statusPercentages.get('ARRIVED') || 0,
      resolvedPercent: statusPercentages.get('RESOLVED') || 0,

      // Trend metrics (percent change from previous period)
      activeIncidentsPercentChange,
      resolvedPercentChange,
      criticalIncidentsPercentChange,
      responseTimePercentChange,

      // Date information
      lastUpdated: new Date().toISOString(),
    };
  }

  private async calculateAverageResponseTime(): Promise<number> {
    const incidents = await this.prisma.incident.findMany({
      where: {
        status: {
          in: [IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED],
        },
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
    });

    if (incidents.length === 0) return 0;

    const totalMinutes = incidents.reduce((sum, incident) => {
      const firstAssignment = incident.assignments[0];
      if (!firstAssignment) return sum;

      const responseTime = firstAssignment.assignedAt.getTime() - incident.reportedAt.getTime();
      return sum + responseTime / (1000 * 60); // Convert to minutes
    }, 0);

    return Math.round(totalMinutes / incidents.length);
  }

  /**
   * Calculate the average time from report to resolution
   * @returns Average resolution time in minutes
   */
  private async calculateAverageResolutionTime(): Promise<number> {
    const resolvedIncidents = await this.prisma.incident.findMany({
      where: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: { not: null },
      },
      select: {
        reportedAt: true,
        resolvedAt: true,
      },
    });

    if (resolvedIncidents.length === 0) return 0;

    const totalMinutes = resolvedIncidents.reduce((sum, incident) => {
      if (!incident.resolvedAt) return sum;

      const resolutionTime = incident.resolvedAt.getTime() - incident.reportedAt.getTime();
      return sum + resolutionTime / (1000 * 60); // Convert to minutes
    }, 0);

    return Math.round(totalMinutes / resolvedIncidents.length);
  }

  private async findNearestBarangay(lat: number, lon: number) {
    const barangays = await this.prisma.barangay.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
      },
    });

    if (barangays.length === 0) return null;

    let nearest = barangays[0];
    let minDistance = this.calculateDistance(lat, lon, nearest.latitude, nearest.longitude);

    for (const barangay of barangays) {
      const distance = this.calculateDistance(lat, lon, barangay.latitude, barangay.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = barangay;
      }
    }

    return nearest;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async acknowledgeIncident(incidentId: string, personnelId: string) {
    // Check if incident exists
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Check if personnel exists
    const personnel = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    // Create or update acknowledgment (upsert to handle duplicate calls)
    const ack = await this.prisma.incidentNotificationAck.upsert({
      where: {
        incidentId_personnelId: {
          incidentId,
          personnelId,
        },
      },
      create: {
        incidentId,
        personnelId,
      },
      update: {
        acknowledgedAt: new Date(),
      },
    });

    return ack;
  }

  async getIncidentAcknowledgments(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        notificationAcks: {
          include: {
            personnel: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Count total active personnel (those who should be notified)
    const totalActivePersonnel = await this.prisma.personnel.count({
      where: {
        status: {
          in: ['AVAILABLE', 'ON_DUTY', 'ON_BREAK'],
        },
      },
    });

    const acknowledgedCount = incident.notificationAcks.length;
    const acknowledgmentPercentage = totalActivePersonnel > 0
      ? Math.round((acknowledgedCount / totalActivePersonnel) * 100)
      : 0;

    return {
      incidentId: incident.id,
      incidentNumber: incident.incidentNumber,
      totalPersonnelNotified: totalActivePersonnel,
      acknowledgedCount,
      acknowledgmentPercentage,
      acknowledgments: incident.notificationAcks.map(ack => ({
        personnelId: ack.personnelId,
        personnelName: `${ack.personnel.firstName} ${ack.personnel.lastName}`,
        personnelRole: ack.personnel.role,
        acknowledgedAt: ack.acknowledgedAt,
      })),
    };
  }

  async getBulkIncidentAcknowledgments(incidentIds: string[]) {
    const incidents = await this.prisma.incident.findMany({
      where: {
        id: { in: incidentIds },
      },
      include: {
        notificationAcks: {
          select: {
            personnelId: true,
          },
        },
      },
    });

    // Count total active personnel once
    const totalActivePersonnel = await this.prisma.personnel.count({
      where: {
        status: {
          in: ['AVAILABLE', 'ON_DUTY', 'ON_BREAK'],
        },
      },
    });

    return incidents.map(incident => ({
      id: incident.id,
      incidentNumber: incident.incidentNumber,
      totalPersonnelNotified: totalActivePersonnel,
      acknowledgedCount: incident.notificationAcks.length,
      acknowledgmentPercentage: totalActivePersonnel > 0
        ? Math.round((incident.notificationAcks.length / totalActivePersonnel) * 100)
        : 0,
      acknowledgedPersonnelIds: incident.notificationAcks.map(ack => ack.personnelId),
    }));
  }

  private validateStatusTransition(currentStatus: IncidentStatus, newStatus: IncidentStatus) {
    const validTransitions: Record<IncidentStatus, IncidentStatus[]> = {
      [IncidentStatus.PENDING_VERIFICATION]: [IncidentStatus.VERIFIED, IncidentStatus.SPAM],
      [IncidentStatus.VERIFIED]: [IncidentStatus.ACKNOWLEDGED, IncidentStatus.RESPONDING, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
      [IncidentStatus.REPORTED]: [IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
      [IncidentStatus.ACKNOWLEDGED]: [IncidentStatus.DISPATCHED, IncidentStatus.RESPONDING, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
      [IncidentStatus.DISPATCHED]: [IncidentStatus.RESPONDING, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
      [IncidentStatus.RESPONDING]: [IncidentStatus.ARRIVED, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
      [IncidentStatus.ARRIVED]: [IncidentStatus.PENDING_RESOLVE, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
      [IncidentStatus.IN_PROGRESS]: [IncidentStatus.PENDING_RESOLVE, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
      [IncidentStatus.PENDING_RESOLVE]: [IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
      [IncidentStatus.RESOLVED]: [IncidentStatus.CLOSED],
      [IncidentStatus.CLOSED]: [IncidentStatus.REPORTED], // Can reopen
      [IncidentStatus.CANCELLED]: [IncidentStatus.REPORTED], // Can reactivate
      [IncidentStatus.SPAM]: [IncidentStatus.REPORTED]
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Verify an incident (Admin action)
   */
  async verifyIncident(
    incidentId: string,
    userId: string,
    priority?: IncidentPriority,
    notes?: string
  ) {
    console.log('🔍 verifyIncident called with:', { incidentId, userId, priority, notes });

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      console.log('❌ Incident not found:', incidentId);
      throw new NotFoundError('Incident not found');
    }

    console.log('📊 Incident status:', incident.status);

    if (incident.status !== IncidentStatus.PENDING_VERIFICATION) {
      console.log('❌ Invalid status for verification:', incident.status);
      throw new ValidationError(
        'Only pending incidents can be verified'
      );
    }

    // Update incident status to VERIFIED and optionally priority
    const updatedIncident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: IncidentStatus.VERIFIED,
        verifiedAt: new Date(),
        ...(priority && { priority }),
      },
      include: {
        barangay: {
          select: {
            id: true,
            name: true,
            code: true,
            latitude: true,
            longitude: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignments: {
          include: {
            personnel: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Add timeline entry - temporarily disabled to fix 500 error
    // const timelineService = new TimelineService(this.prisma);
    // await timelineService.addEntry({
    //   incidentId,
    //   status: IncidentStatus.VERIFIED,
    //   userId,
    //   notes: notes || 'Incident verified by admin',
    // });

    // Calculate total personnel to be notified (available, on duty, on break)
    const totalPersonnelNotified = await this.prisma.personnel.count({
      where: {
        status: {
          in: ['AVAILABLE', 'ON_DUTY', 'ON_BREAK'],
        },
      },
    });

    return {
      ...this.mapIncidentForFrontend(updatedIncident),
      totalPersonnelNotified,
      acknowledgmentCount: 0,
      acknowledgmentPercentage: 0,
    };
  }

  /**
   * Resolve an incident (Admin action)
   */
  async resolveIncident(
    incidentId: string,
    userId: string,
    resolutionNotes: string
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        responders: true,
      },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    if (!resolutionNotes || resolutionNotes.trim().length < 10) {
      throw new ValidationError(
        'Resolution notes must be at least 10 characters'
      );
    }

    // Update incident status to RESOLVED and automatically close
    const closedIncident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: IncidentStatus.CLOSED,
        closedAt: new Date(),
      },
      include: {
        barangay: true,
        resolvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        responders: {
          include: {
            personnel: true,
          },
        },
      },
    });

    // Add timeline entry for CLOSED
    const timelineService = new TimelineService(this.prisma);
    await timelineService.addEntry({
      incidentId,
      status: IncidentStatus.CLOSED,
      userId,
      notes: 'Incident closed automatically after resolution',
    });

    return this.mapIncidentForFrontend(closedIncident);
  }

  /**
   * Get responders for an incident
   */
  async getResponders(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        assignments: {
          include: {
            personnel: {
              include: {
                locations: {
                  orderBy: { timestamp: 'desc' },
                  take: 1,
                },
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    return {
      totalResponders: incident.assignments.length,
      responders: incident.assignments.map((assignment: any) => {
        const location = assignment.personnel.locations[0];
        return {
          assignmentId: assignment.id,
          assignedAt: assignment.assignedAt,
          arrivedAt: assignment.arrivedAt,
          isPrimary: assignment.personnelId === incident.primaryResponderId,
          personnel: {
            id: assignment.personnel.id,
            firstName: assignment.personnel.firstName,
            lastName: assignment.personnel.lastName,
            role: assignment.personnel.role,
            photo: assignment.personnel.photo,
          },
          eta: location && !assignment.arrivedAt
            ? this.calculateETA(
              location.latitude,
              location.longitude,
              incident.latitude,
              incident.longitude
            )
            : null,
          currentLocation: location
            ? {
              lat: location.latitude,
              lng: location.longitude,
              timestamp: location.timestamp,
            }
            : null,
        };
      }),
    };
  }

  /**
   * Format responder data with ETA calculation
   */
  private formatResponder(responder: any, incident: any) {
    const location = responder.personnel.locations[0];

    return {
      id: responder.personnelId,
      name: `${responder.personnel.firstName} ${responder.personnel.lastName}`,
      role: responder.personnel.role,
      acceptedAt: responder.acceptedAt,
      arrivedAt: responder.arrivedAt,
      eta: location && !responder.arrivedAt
        ? this.calculateETA(
          location.latitude,
          location.longitude,
          incident.latitude,
          incident.longitude
        )
        : null,
      currentLocation: location
        ? {
          lat: location.latitude,
          lng: location.longitude,
        }
        : null,
      isPrimary: responder.isPrimary,
    };
  }

  /**
   * Simple ETA calculation (distance-based)
   * TODO: Replace with Google Maps Distance Matrix API for accurate ETAs
   */
  private calculateETA(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): number {
    // Haversine formula for distance
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(toLat - fromLat);
    const dLon = this.toRad(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(fromLat)) *
      Math.cos(this.toRad(toLat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km

    // Assume average speed of 30 km/h in city traffic
    const avgSpeed = 30;
    const timeInHours = distance / avgSpeed;
    const timeInMinutes = Math.ceil(timeInHours * 60);

    return timeInMinutes;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Submit incident resolution (Personnel)
   */
  async submitResolution(incidentId: string, data: SubmitResolutionDTO) {
    // Verify incident exists and is in valid status
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        assignments: {
          where: { personnelId: data.personnelId }
        }
      }
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Verify personnel is assigned to this incident
    if (incident.assignments.length === 0) {
      throw new ValidationError('You must be assigned to this incident to submit a resolution');
    }

    // Check if incident can be resolved
    const validStatuses = ['RESPONDING', 'ARRIVED', 'IN_PROGRESS'];
    if (!validStatuses.includes(incident.status)) {
      throw new ValidationError('Incident cannot be resolved in current status');
    }

    // Check if resolution already exists
    const existingResolution = await this.prisma.incidentResolution.findUnique({
      where: { incidentId }
    });

    if (existingResolution) {
      throw new ValidationError('Resolution report already submitted for this incident');
    }

    // Create resolution
    const resolution = await this.prisma.incidentResolution.create({
      data: {
        incidentId,
        what: data.what,
        when: data.when,
        where: data.where,
        who: data.who,
        why: data.why,
        how: data.how as any, // Cast to ResolutionOutcome enum
        notes: data.notes,
        submittedByPersonnelId: data.personnelId,
      },
      include: {
        submittedByPersonnel: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          }
        }
      }
    });

    // Update incident status to PENDING_RESOLVE
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: 'PENDING_RESOLVE' }
    });

    // Create update log
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId,
        personnelId: data.personnelId,
        message: 'Resolution report submitted - awaiting admin confirmation',
        updateType: 'STATUS_CHANGE',
      },
    });

    return resolution;
  }

  /**
   * Get incident resolution
   */
  async getResolution(incidentId: string) {
    const resolution = await this.prisma.incidentResolution.findUnique({
      where: { incidentId },
      include: {
        submittedByPersonnel: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            photo: true,
          }
        },
        confirmedByAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          }
        }
      }
    });

    if (!resolution) {
      throw new NotFoundError('Resolution not found');
    }

    return resolution;
  }

  /**
   * Update resolution (Admin only)
   */
  async updateResolution(incidentId: string, data: UpdateResolutionDTO) {
    const resolution = await this.prisma.incidentResolution.findUnique({
      where: { incidentId }
    });

    if (!resolution) {
      throw new NotFoundError('Resolution not found');
    }

    return await this.prisma.incidentResolution.update({
      where: { incidentId },
      data: {
        ...(data.what && { what: data.what }),
        ...(data.when && { when: data.when }),
        ...(data.where && { where: data.where }),
        ...(data.who && { who: data.who }),
        ...(data.why && { why: data.why }),
        ...(data.how && { how: data.how }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
      },
      include: {
        submittedByPersonnel: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          }
        }
      }
    });
  }

  /**
   * Confirm resolution (Admin only)
   */
  async confirmResolution(incidentId: string, adminId: string, data: ConfirmResolutionDTO) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        resolution: true
      }
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    if (!incident.resolution) {
      throw new NotFoundError('No resolution report to confirm');
    }

    if (incident.status !== 'PENDING_RESOLVE') {
      throw new ValidationError('Incident is not pending resolution confirmation');
    }

    // Update resolution with admin confirmation
    await this.prisma.incidentResolution.update({
      where: { incidentId },
      data: {
        confirmedByAdminId: adminId,
        confirmedAt: new Date(),
        ...(data.adminNotes && { adminNotes: data.adminNotes }),
      }
    });

    // Update incident status to RESOLVED
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: adminId,
      }
    });

    // Create update log
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId,
        userId: adminId,
        message: 'Resolution confirmed - incident resolved',
        updateType: 'RESOLVED',
      },
    });

    return await this.getResolution(incidentId);
  }
}
