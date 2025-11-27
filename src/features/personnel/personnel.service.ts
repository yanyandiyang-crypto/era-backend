import { PrismaClient, PersonnelStatus } from '@prisma/client';
import { PasswordService } from '../../core/utils/password';
import { NotFoundError, ValidationError } from '../../core/errors';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.types';
import {
  CreatePersonnelDTO,
  UpdatePersonnelDTO,
  PersonnelListQuery,
  UpdatePersonnelLocationDTO,
} from './personnel.types';
import { CONSTANTS } from '../../config/constants';
import { PaginatedResponse } from '../../types';
import * as jwt from 'jsonwebtoken';
import { env } from '../../config/environment';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Helper function to transform personnel data for frontend
function transformPersonnel(personnel: any) {
  if (!personnel) return null;
  
  // Extract latest location if available
  const latestLocation = personnel.locations && personnel.locations.length > 0 
    ? personnel.locations[0] 
    : null;
  
  // Map status to dutyStatus (frontend expects both fields)
  const dutyStatusMap: Record<string, string> = {
    AVAILABLE: 'AVAILABLE',
    ON_DUTY: 'ON_DUTY',
    OFF_DUTY: 'OFF_DUTY',
    ON_BREAK: 'ON_BREAK',
    INACTIVE: 'UNAVAILABLE',
    SUSPENDED: 'UNAVAILABLE',
  };
  
  return {
    ...personnel,
    personnelId: personnel.id, // Add personnelId field
    dutyStatus: dutyStatusMap[personnel.status] || 'UNAVAILABLE', // Add dutyStatus field
    currentLatitude: latestLocation?.latitude || null, // Add current location
    currentLongitude: latestLocation?.longitude || null,
    profilePhoto: personnel.photo || null, // Map photo to profilePhoto for frontend
    locations: undefined, // Remove locations array from response
  };
}

export class PersonnelService {
  constructor(private prisma: PrismaClient) {}

  // ========================================
  // MOBILE APP AUTH METHODS
  // ========================================

  async login(identifier: string, password: string) {
    // Find personnel by employee ID, email, or phone
    const personnel = await this.prisma.personnel.findFirst({
      where: {
        OR: [
          { employeeId: identifier },
          { email: identifier },
          { phone: identifier },
        ],
      },
      include: {
        locations: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    if (!personnel) {
      throw new ValidationError('Invalid credentials');
    }

    // Verify password
    const isValid = await PasswordService.compare(password, personnel.password);
    if (!isValid) {
      throw new ValidationError('Invalid credentials');
    }

    // Check if personnel is suspended
    if (personnel.status === PersonnelStatus.SUSPENDED) {
      throw new ValidationError('Your account has been suspended');
    }

    // Update last active
    await this.prisma.personnel.update({
      where: { id: personnel.id },
      data: { lastActive: new Date() },
    });

    // Generate tokens using HS256 for mobile compatibility
    const accessToken = jwt.sign(
      { 
        userId: personnel.id,
        id: personnel.id, // Keep for backward compatibility
        email: personnel.email,
        role: 'PERSONNEL', 
        employeeId: personnel.employeeId 
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRY || '24h', algorithm: 'HS256' } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { id: personnel.id, role: 'PERSONNEL' },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRY || '30d', algorithm: 'HS256' } as jwt.SignOptions
    );

    // Remove password from response
    const { password: _, ...personnelData } = personnel;

    return {
      accessToken,
      refreshToken,
      personnel: transformPersonnel(personnelData),
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as any;

      // Get personnel
      const personnel = await this.prisma.personnel.findUnique({
        where: { id: decoded.id },
        include: {
          locations: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      if (!personnel || personnel.status === PersonnelStatus.SUSPENDED) {
        throw new ValidationError('Invalid refresh token');
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { id: personnel.id, role: 'PERSONNEL', employeeId: personnel.employeeId },
        env.JWT_ACCESS_SECRET,
        { expiresIn: env.JWT_ACCESS_EXPIRY || '24h', algorithm: 'HS256' } as jwt.SignOptions
      );

      // Remove password from response
      const { password: _, ...personnelData } = personnel;

      return {
        accessToken,
        refreshToken, // Return same refresh token
        personnel: transformPersonnel(personnelData),
      };
    } catch (error) {
      throw new ValidationError('Invalid refresh token');
    }
  }

  async changePassword(personnelId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Find personnel
    const personnel = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await PasswordService.compare(
      currentPassword,
      personnel.password
    );

    if (!isCurrentPasswordValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await PasswordService.hash(newPassword);

    // Update password
    await this.prisma.personnel.update({
      where: { id: personnelId },
      data: { password: hashedPassword },
    });
  }

  // ========================================
  // MOBILE APP METHODS
  // ========================================

  async updatePersonnelStatus(id: string, status: string, userId?: string) {
    // Validate status
    const validStatuses = ['AVAILABLE', 'ON_DUTY', 'OFF_DUTY', 'ON_BREAK'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status');
    }

    // Get current status for audit log
    const current = await this.prisma.personnel.findUnique({
      where: { id },
      select: { status: true, employeeId: true },
    });

    const personnel = await this.prisma.personnel.update({
      where: { id },
      data: {
        status: status as PersonnelStatus,
        isAvailable: status === 'ON_DUTY' || status === 'AVAILABLE',
        lastActive: new Date(),
      },
      include: {
        locations: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    // OWASP A09: Audit log status changes
    if (userId && current) {
      const auditService = new AuditService(this.prisma);
      await auditService.createLog({
        userId,
        action: AuditAction.PERSONNEL_UPDATED,
        resourceType: 'PERSONNEL',
        resourceId: id,
        details: {
          employeeId: current.employeeId,
          field: 'status',
          oldValue: current.status,
          newValue: status,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return transformPersonnel(personnel);
  }

  async uploadPersonnelPhoto(id: string, request: any) {
    // Check if request is multipart
    if (!request.isMultipart || !request.isMultipart()) {
      throw new ValidationError('Request must be multipart/form-data');
    }

    const data = await request.file();
    if (!data) {
      throw new ValidationError('No file uploaded');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(data.mimetype)) {
      throw new ValidationError('Invalid file type. Only JPEG, PNG, and WebP are allowed');
    }

    // Generate unique filename
    const fileExt = path.extname(data.filename);
    const filename = `personnel-${id}-${crypto.randomBytes(8).toString('hex')}${fileExt}`;
    const uploadDir = env.UPLOAD_DIR || './uploads';
    const filepath = path.join(uploadDir, filename);

    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file
    const buffer = await data.toBuffer();
    await fs.writeFile(filepath, buffer);

    // Update personnel photo URL
    const photoUrl = `/uploads/${filename}`;
    await this.prisma.personnel.update({
      where: { id },
      data: { photo: photoUrl },
    });

    return photoUrl;
  }

  async getAssignedIncidents(_personnelId: string) {
    // Get all active incidents (not using assignments, using broadcast alerts)
    // Personnel will see all active incidents in their area
    const incidents = await this.prisma.incident.findMany({
      where: {
        status: {
          in: ['VERIFIED', 'REPORTED', 'ACKNOWLEDGED', 'DISPATCHED', 'IN_PROGRESS', 'RESPONDING', 'ARRIVED'],
        },
      },
      include: {
        photos: {
          select: {
            id: true,
            url: true,
            caption: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: {
        reportedAt: 'desc',
      },
      take: 50, // Limit to 50 most recent
    });

    // Transform to match mobile app format
    return incidents.map((incident) => ({
      ...incident,
      photos: incident.photos.map((photo) => ({
        photoId: photo.id,
        url: photo.url,
        caption: photo.caption,
        uploadedAt: photo.uploadedAt,
      })),
      assignedPersonnel: [], // No assignments, using alerts
    }));
  }

  async getIncidentHistory(personnelId: string) {
    const incidents = await this.prisma.incident.findMany({
      where: {
        assignments: {
          some: {
            personnelId,
          },
        },
        status: {
          in: ['RESOLVED', 'CLOSED', 'CANCELLED'],
        },
      },
      include: {
        photos: {
          select: {
            id: true,
            url: true,
            caption: true,
            uploadedAt: true,
          },
        },
        assignments: {
          where: { personnelId },
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
      orderBy: {
        resolvedAt: 'desc',
      },
      take: 50, // Limit to last 50
    });

    // Transform to match mobile app format
    return incidents.map((incident) => ({
      ...incident,
      photos: incident.photos.map((photo) => ({
        photoId: photo.id,
        url: photo.url,
        caption: photo.caption,
        uploadedAt: photo.uploadedAt,
      })),
      assignedPersonnel: incident.assignments.map((assignment) => ({
        personnelId: assignment.personnel.id,
        name: `${assignment.personnel.firstName} ${assignment.personnel.lastName}`,
        role: assignment.personnel.role,
        assignedAt: assignment.assignedAt,
      })),
      assignments: undefined, // Remove assignments array
    }));
  }

  // ========================================
  // ADMIN METHODS
  // ========================================

  async createPersonnel(data: CreatePersonnelDTO) {
    try {
      // Check if email or employeeId already exists
      const existing = await this.prisma.personnel.findFirst({
        where: {
          OR: [{ email: data.email }, { employeeId: data.employeeId }],
        },
      });

      if (existing) {
        if (existing.email === data.email) {
          throw new ValidationError('Email already exists. Please use a different email address.', [
            {
              field: 'email',
              message: 'This email is already registered',
            },
          ]);
        }
        throw new ValidationError('Employee ID already exists. Please use a different employee ID.', [
          {
            field: 'employeeId',
            message: 'This employee ID is already in use',
          },
        ]);
      }

      // Validate phone number format (accept +63 or 09 format)
      const phoneRegex = /^(\+63|63|09)\d{9,10}$/;
      if (!phoneRegex.test(data.phone.replace(/[\s-]/g, ''))) {
        throw new ValidationError('Invalid phone number format. Use +639XXXXXXXXX or 09XXXXXXXXX format', [
          {
            field: 'phone',
            message: 'Phone number must start with +63, 63, or 09 followed by 9-10 digits',
          },
        ]);
      }

      // Normalize phone number to +63 format
      let normalizedPhone = data.phone.replace(/[\s-]/g, '');
      if (normalizedPhone.startsWith('09')) {
        normalizedPhone = '+63' + normalizedPhone.substring(1);
      } else if (normalizedPhone.startsWith('63') && !normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone;
      }
      data.phone = normalizedPhone;

      // Hash password
      const hashedPassword = await PasswordService.hash(data.password);

      // Create personnel
      const personnel = await this.prisma.personnel.create({
        data: {
          ...data,
          password: hashedPassword,
        },
        select: {
          id: true,
          employeeId: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          photo: true,
          isAvailable: true,
          createdAt: true,
        },
      });

      return transformPersonnel(personnel);
    } catch (error: any) {
      // Handle Prisma unique constraint errors
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'field';
        throw new ValidationError(`${field} already exists. Please use a different value.`, [
          {
            field: field,
            message: `This ${field} is already in use`,
          },
        ]);
      }

      // Re-throw if it's already a ValidationError
      if (error instanceof ValidationError) {
        throw error;
      }

      // Handle other errors
      throw new Error(`Failed to create personnel: ${error.message}`);
    }
  }

  async getPersonnel(query: PersonnelListQuery): Promise<PaginatedResponse<any>> {
    const page = query.page || 1;
    const limit = query.limit || CONSTANTS.DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const where: any = {};
    const andConditions: any[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { employeeId: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.role) {
      // Handle comma-separated roles
      const roles = typeof query.role === 'string' ? query.role.split(',').map(r => r.trim()) : [query.role];
      if (roles.length === 1) {
        andConditions.push({ role: roles[0] });
      } else {
        andConditions.push({
          OR: roles.map(role => ({ role })),
        });
      }
    }

    if (query.status) {
      // Handle comma-separated statuses
      const statuses = typeof query.status === 'string' ? query.status.split(',').map(s => s.trim()) : [query.status];
      if (statuses.length === 1) {
        andConditions.push({ status: statuses[0] });
      } else {
        andConditions.push({
          OR: statuses.map(status => ({ status })),
        });
      }
    }

    if (query.isAvailable !== undefined) {
      andConditions.push({ isAvailable: query.isAvailable });
    }

    // Combine all conditions with AND
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const total = await this.prisma.personnel.count({ where });

    const personnel = await this.prisma.personnel.findMany({
      where,
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        photo: true,
        isAvailable: true,
        currentDuty: true,
        createdAt: true,
        lastActive: true,
        locations: {
          select: {
            latitude: true,
            longitude: true,
            timestamp: true,
          },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: personnel.map(transformPersonnel),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPersonnelById(id: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        photo: true,
        dateOfBirth: true,
        bloodType: true,
        address: true,
        emergencyContact: true,
        isAvailable: true,
        currentDuty: true,
        createdAt: true,
        updatedAt: true,
        lastActive: true,
      },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    return transformPersonnel(personnel);
  }

  async updatePersonnel(id: string, data: UpdatePersonnelDTO) {
    const existing = await this.prisma.personnel.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Personnel not found');
    }

    // Check if email is being changed and already exists
    if (data.email && data.email !== existing.email) {
      const emailExists = await this.prisma.personnel.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new ValidationError('Email already exists');
      }
    }

    const personnel = await this.prisma.personnel.update({
      where: { id },
      data,
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        photo: true,
        isAvailable: true,
        currentDuty: true,
        updatedAt: true,
      },
    });

    return transformPersonnel(personnel);
  }

  async suspendPersonnel(id: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    const updated = await this.prisma.personnel.update({
      where: { id },
      data: {
        status: PersonnelStatus.SUSPENDED,
        isAvailable: false,
      },
      select: {
        id: true,
        status: true,
        isAvailable: true,
      },
    });

    return transformPersonnel(updated);
  }

  async activatePersonnel(id: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    const updated = await this.prisma.personnel.update({
      where: { id },
      data: {
        status: PersonnelStatus.AVAILABLE,
        isAvailable: true,
      },
      select: {
        id: true,
        status: true,
        isAvailable: true,
      },
    });

    return transformPersonnel(updated);
  }

  async deletePersonnel(id: string) {
    const existing = await this.prisma.personnel.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Personnel not found');
    }

    await this.prisma.personnel.delete({
      where: { id },
    });

    return { id };
  }

  async updateLocation(id: string, data: UpdatePersonnelLocationDTO) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    const location = await this.prisma.personnelLocation.create({
      data: {
        personnelId: id,
        ...data,
      },
    });

    // Update last active
    await this.prisma.personnel.update({
      where: { id },
      data: { lastActive: new Date() },
    });

    return location;
  }

  async getPersonnelLocation(id: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    const location = await this.prisma.personnelLocation.findFirst({
      where: { personnelId: id },
      orderBy: { timestamp: 'desc' },
    });

    return location;
  }

  async getPersonnelLocationHistory(id: string, limit: number = 10) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    const locations = await this.prisma.personnelLocation.findMany({
      where: { personnelId: id },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return locations;
  }

  async resetPassword(id: string, newPassword: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    const hashedPassword = await PasswordService.hash(newPassword);
    
    await this.prisma.personnel.update({
      where: { id },
      data: { 
        password: hashedPassword,
      },
    });
  }

  async getAssignmentHistory(personnelId: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
    });

    if (!personnel) {
      throw new NotFoundError('Personnel not found');
    }

    const assignments = await this.prisma.incidentAssignment.findMany({
      where: { personnelId },
      include: {
        incident: {
          select: {
            incidentNumber: true,
            type: true,
            address: true,
            status: true,
            responseTime: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
      take: 50, // Limit to recent 50 assignments
    });

    return assignments.map((assignment) => {
      // Calculate response time if arrivedAt exists
      const responseTime = assignment.arrivedAt
        ? Math.round((assignment.arrivedAt.getTime() - assignment.assignedAt.getTime()) / 60000)
        : assignment.incident?.responseTime;

      return {
        id: assignment.id,
        incidentId: assignment.incidentId,
        personnelId: assignment.personnelId,
        assignedAt: assignment.assignedAt,
        arrivedAt: assignment.arrivedAt,
        completedAt: assignment.completedAt,
        responseTime,
        status: assignment.completedAt ? 'COMPLETED' : assignment.arrivedAt ? 'ON_SCENE' : 'ASSIGNED',
        incident: assignment.incident ? {
          trackingNumber: assignment.incident.incidentNumber,
          type: assignment.incident.type,
          address: assignment.incident.address,
          status: assignment.incident.status,
        } : undefined,
      };
    });
  }

  async getPersonnelStats() {
    const [total, active, suspended, available, onDuty, byRole] = await Promise.all([
      this.prisma.personnel.count(),
      this.prisma.personnel.count({ where: { status: PersonnelStatus.AVAILABLE } }),
      this.prisma.personnel.count({ where: { status: PersonnelStatus.SUSPENDED } }),
      this.prisma.personnel.count({ where: { isAvailable: true } }),
      this.prisma.personnel.count({ where: { status: PersonnelStatus.ON_DUTY } }),
      this.prisma.personnel.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    return {
      total,
      active,
      suspended,
      available,
      onDuty,
      byRole: byRole.map((r) => ({
        role: r.role,
        count: r._count,
      })),
    };
  }
}
