import { PrismaClient, IncidentStatus } from '@prisma/client';

export interface TimelineEntry {
  incidentId: string;
  status: IncidentStatus;
  notes?: string;
  userId?: string;
  personnelId?: string;
  metadata?: Record<string, any>;
}

export class TimelineService {
  static addEntry(_arg0: { incidentId: string; status: "CLOSED"; userId: string; notes: string; }) {
    throw new Error('Method not implemented.');
  }
  constructor(private prisma: PrismaClient) {}

  /**
   * Add an entry to the incident timeline
   */
  async addEntry(entry: TimelineEntry) {
    console.log('🔍 TimelineService.addEntry called with:', {
      incidentId: entry.incidentId,
      status: entry.status,
      userId: entry.userId,
      personnelId: entry.personnelId,
      notes: entry.notes,
    });
    
    // Validate userId if provided
    if (entry.userId) {
      console.log('🔍 Checking if user exists:', entry.userId);
      const userExists = await this.prisma.user.findUnique({
        where: { id: entry.userId },
        select: { id: true },
      });
      console.log('🔍 User exists:', userExists);
      if (!userExists) {
        console.log('❌ User does not exist, setting userId to undefined');
        entry.userId = undefined;
      }
    }

    // Validate personnelId if provided
    if (entry.personnelId) {
      const personnelExists = await this.prisma.personnel.findUnique({
        where: { id: entry.personnelId },
        select: { id: true },
      });
      if (!personnelExists) {
        entry.personnelId = undefined;
      }
    }

    return this.prisma.incidentTimeline.create({
      data: {
        incidentId: entry.incidentId,
        status: entry.status,
        notes: entry.notes,
        userId: entry.userId,
        personnelId: entry.personnelId,
        metadata: entry.metadata || {},
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
        personnel: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get timeline for an incident
   */
  async getTimeline(incidentId: string) {
    const timeline = await this.prisma.incidentTimeline.findMany({
      where: { incidentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        personnel: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    return timeline.map((entry) => ({
      id: entry.id,
      status: entry.status,
      timestamp: entry.timestamp,
      notes: entry.notes,
      actor: entry.user
        ? {
            type: 'user' as const,
            id: entry.user.id,
            name: `${entry.user.firstName} ${entry.user.lastName}`,
            email: entry.user.email,
          }
        : entry.personnel
        ? {
            type: 'personnel' as const,
            id: entry.personnel.id,
            name: `${entry.personnel.firstName} ${entry.personnel.lastName}`,
            role: entry.personnel.role,
          }
        : null,
      metadata: entry.metadata,
    }));
  }

  /**
   * Get latest timeline entry for an incident
   */
  async getLatestEntry(incidentId: string) {
    return this.prisma.incidentTimeline.findFirst({
      where: { incidentId },
      orderBy: { timestamp: 'desc' },
      include: {
        user: true,
        personnel: true,
      },
    });
  }
}
