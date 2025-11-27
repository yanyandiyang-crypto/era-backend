import { PrismaClient, IncidentType, IncidentStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../core/errors';
import { SanitizationService } from '../../core/utils/sanitization';
import type {
  CreatePublicIncidentDTO,
  PublicSessionDTO,
  PublicIncidentResponse,
  PublicBarangayResponse,
} from './public.types';

export class PublicService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create or retrieve a public session
   */
  async createSession(ipAddress?: string, userAgent?: string): Promise<PublicSessionDTO> {
    // Check if there's a recent session from this IP (within last 24 hours)
    let session;
    
    if (ipAddress) {
      session = await this.prisma.publicSession.findFirst({
        where: {
          ipAddress,
          expiresAt: { gt: new Date() },
          isFlagged: false,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // If no session found or expired, create new one
    if (!session) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      session = await this.prisma.publicSession.create({
        data: {
          ipAddress,
          userAgent,
          expiresAt,
        },
      });
    }

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Validate session and check rate limits
   */
  async validateSession(sessionToken: string): Promise<void> {
    const session = await this.prisma.publicSession.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      throw new ValidationError('Invalid session token');
    }

    if (session.expiresAt < new Date()) {
      throw new ValidationError('Session expired');
    }

    if (session.isFlagged) {
      throw new ValidationError('Session has been flagged for suspicious activity');
    }

    // Rate limiting: Max 1 report per 30 minutes per session
    // DISABLED FOR TESTING - Uncomment to enable rate limiting
    /*
    if (session.lastReportAt) {
      const minutesSinceLastReport = (Date.now() - session.lastReportAt.getTime()) / (1000 * 60);
      if (minutesSinceLastReport < 30) {
        throw new ValidationError(
          `Please wait ${Math.ceil(30 - minutesSinceLastReport)} minutes before submitting another report`
        );
      }
    }
    */
  }

  /**
   * Create a public incident report
   */
  async createIncident(data: CreatePublicIncidentDTO, sessionToken: string): Promise<PublicIncidentResponse> {
    // Validate session and get session data
    await this.validateSession(sessionToken);
    
    // Get session to retrieve its ID
    const session = await this.prisma.publicSession.findUnique({
      where: { sessionToken },
    });
    
    if (!session) {
      throw new ValidationError('Invalid session token');
    }

    // OWASP A03/V5: Sanitize all text inputs to prevent XSS
    const sanitizedData = {
      ...data,
      description: SanitizationService.sanitizeString(data.description),
      address: SanitizationService.sanitizeString(data.address),
      landmark: data.landmark ? SanitizationService.sanitizeString(data.landmark) : undefined,
      reporterName: SanitizationService.sanitizeString(data.reporterName),
      reporterPhone: SanitizationService.sanitizePhoneNumber(data.reporterPhone),
    };
    
    // Additional validation after sanitization
    if (!sanitizedData.reporterPhone) {
      throw new ValidationError('Invalid phone number format');
    }
    
    // Check for duplicate reports (same type + location within 30 minutes)
    // DISABLED FOR TESTING - Uncomment to enable duplicate checking
    /*
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const duplicate = await this.prisma.incident.findFirst({
      where: {
        type: data.type,
        latitude: { gte: data.latitude - 0.001, lte: data.latitude + 0.001 },
        longitude: { gte: data.longitude - 0.001, lte: data.longitude + 0.001 },
        reportedAt: { gte: thirtyMinutesAgo },
        status: { notIn: ['CLOSED', 'CANCELLED', 'SPAM'] },
      },
    });

    if (duplicate) {
      throw new ValidationError(
        'A similar incident has already been reported in this area. Please check existing reports.'
      );
    }
    */

    // Find nearest barangay
    const barangays = await this.prisma.barangay.findMany({
      where: { isActive: true },
    });

    let nearestBarangay = null;
    let minDistance = Infinity;

    for (const barangay of barangays) {
      const distance = this.calculateDistance(
        data.latitude,
        data.longitude,
        barangay.latitude,
        barangay.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestBarangay = barangay;
      }
    }

    // Generate incident number
    const year = new Date().getFullYear();
    const count = await this.prisma.incident.count({
      where: {
        incidentNumber: { startsWith: `INC${year}` },
      },
    });
    const incidentNumber = `INC${year}-${String(count + 1).padStart(4, '0')}`;

    // Create incident with PENDING_VERIFICATION status
    // Priority will be set by admin during verification
    const incident = await this.prisma.incident.create({
      data: {
        incidentNumber,
        type: sanitizedData.type,
        priority: 'MEDIUM', // Default, admin will set actual priority during verification
        status: IncidentStatus.PENDING_VERIFICATION,
        title: `${sanitizedData.type} - ${sanitizedData.address}`,
        description: sanitizedData.description,
        latitude: sanitizedData.latitude,
        longitude: sanitizedData.longitude,
        address: sanitizedData.address,
        landmark: sanitizedData.landmark,
        reporterName: sanitizedData.reporterName,
        reporterPhone: sanitizedData.reporterPhone,
        isPublicReport: true,
        publicSessionId: session.id,
        barangayId: nearestBarangay?.id,
      },
      include: {
        photos: {
          select: { id: true, url: true },
        },
      },
    });

    // Update session stats
    await this.prisma.publicSession.update({
      where: { sessionToken },
      data: {
        reportCount: { increment: 1 },
        lastReportAt: new Date(),
      },
    });

    // Create initial update
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId: incident.id,
        message: 'Incident reported by public user. Awaiting verification.',
        updateType: 'STATUS_CHANGE',
        metadata: { status: 'PENDING_VERIFICATION', source: 'public' },
      },
    });

    return this.formatPublicIncident(incident);
  }

  /**
   * Get active incidents for public view
   * Includes PENDING_VERIFICATION so public reports appear immediately
   * Includes VERIFIED, RESPONDING, ARRIVED so verified incidents remain visible
   */
  async getActiveIncidents(type?: IncidentType, limit = 50): Promise<PublicIncidentResponse[]> {
    const incidents = await this.prisma.incident.findMany({
      where: {
        type: type || undefined,
        status: {
          in: ['PENDING_VERIFICATION', 'VERIFIED', 'REPORTED', 'ACKNOWLEDGED', 'DISPATCHED', 'IN_PROGRESS', 'RESPONDING', 'ARRIVED'],
        },
      },
      include: {
        photos: {
          select: { id: true, url: true },
        },
      },
      orderBy: { reportedAt: 'desc' },
      take: limit,
    });

    return incidents.map((incident) => this.formatPublicIncident(incident));
  }

  /**
   * Get single incident (limited info)
   */
  async getIncidentById(id: string): Promise<PublicIncidentResponse> {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        photos: {
          select: { id: true, url: true },
        },
      },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Hide spam incidents from public view
    if (incident.status === 'SPAM') {
      throw new NotFoundError('Incident not found');
    }

    return this.formatPublicIncident(incident);
  }

  /**
   * Get active barangays/posts for public view
   */
  async getBarangays(): Promise<PublicBarangayResponse[]> {
    const barangays = await this.prisma.barangay.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        latitude: true,
        longitude: true,
        address: true,
        contactPhone: true,
        emergencyContacts: true,
        operatingHours: true,
      },
    });

    return barangays.map(b => ({
      ...b,
      description: b.description ?? undefined,
      contactPhone: b.contactPhone ?? undefined,
      emergencyContacts: b.emergencyContacts ?? undefined,
      operatingHours: b.operatingHours ?? undefined,
    }));
  }

  /**
   * Format incident for public response (hide sensitive data)
   */
  private formatPublicIncident(incident: any): PublicIncidentResponse {
    return {
      id: incident.id,
      incidentNumber: incident.incidentNumber,
      type: incident.type,
      priority: incident.priority,
      status: incident.status,
      title: incident.title,
      description: incident.description,
      latitude: incident.latitude,
      longitude: incident.longitude,
      address: incident.address,
      landmark: incident.landmark,
      reportedAt: incident.reportedAt,
      photos: incident.photos,
    };
  }

  /**
   * Add photo to incident
   */
  async addPhoto(incidentId: string, photoData: { filename: string; filepath: string; url: string; mimeType?: string; size?: number }) {
    return await this.prisma.incidentPhoto.create({
      data: {
        incidentId,
        filename: photoData.filename,
        filepath: photoData.filepath,
        url: photoData.url,
        mimeType: photoData.mimeType || 'image/jpeg',
        size: photoData.size || 0,
      },
    });
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
