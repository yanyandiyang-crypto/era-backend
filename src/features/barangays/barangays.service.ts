import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../core/errors';
import {
  CreateBarangayDTO,
  UpdateBarangayDTO,
  BarangayListQuery,
  NearbyQuery,
} from './barangays.types';
import { CONSTANTS } from '../../config/constants';
import { PaginatedResponse } from '../../types';

export class BarangaysService {
  constructor(private prisma: PrismaClient) {}

  async createBarangay(data: CreateBarangayDTO) {
    // Check if name already exists
    const existing = await this.prisma.barangay.findFirst({
      where: { name: data.name },
    });

    if (existing) {
      throw new ValidationError('Barangay name already exists');
    }

    // Generate code if not provided
    const code = data.code || data.name.toUpperCase().replace(/\s+/g, '_');

    // Check if code already exists
    const codeExists = await this.prisma.barangay.findFirst({
      where: { code },
    });

    if (codeExists) {
      throw new ValidationError('Barangay code already exists');
    }

    // Extract emergency contacts from data
    const { emergencyContacts, ...barangayData } = data;

    const barangay = await this.prisma.barangay.create({
      data: {
        ...barangayData,
        code,
        emergencyContacts: emergencyContacts
          ? {
              create: emergencyContacts.map((contact) => ({
                name: contact.name,
                phone: contact.phone,
                type: contact.type,
                isPrimary: contact.isPrimary || false,
              })),
            }
          : undefined,
      },
      include: {
        emergencyContacts: true,
      },
    });

    return barangay;
  }

  async getBarangays(query: BarangayListQuery): Promise<PaginatedResponse<any>> {
    const page = query.page || 1;
    const limit = query.limit || CONSTANTS.DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const total = await this.prisma.barangay.count({ where });

    const barangays = await this.prisma.barangay.findMany({
      where,
      include: {
        emergencyContacts: true,
        _count: {
          select: {
            incidents: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    });

    // Transform to include incident count
    const data = barangays.map((b) => ({
      ...b,
      incidentCount: b._count.incidents,
    }));

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

  async getBarangayById(id: string) {
    const barangay = await this.prisma.barangay.findUnique({
      where: { id },
      include: {
        emergencyContacts: true,
        _count: {
          select: {
            incidents: true,
          },
        },
      },
    });

    if (!barangay) {
      throw new NotFoundError('Barangay not found');
    }

    return {
      ...barangay,
      incidentCount: barangay._count.incidents,
    };
  }

  async updateBarangay(id: string, data: UpdateBarangayDTO) {
    const existing = await this.prisma.barangay.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Barangay not found');
    }

    // Check if name is being changed and already exists
    if (data.name && data.name !== existing.name) {
      const nameExists = await this.prisma.barangay.findFirst({
        where: { name: data.name },
      });

      if (nameExists) {
        throw new ValidationError('Barangay name already exists');
      }
    }

    // Check if code is being changed and already exists
    if (data.code && data.code !== existing.code) {
      const codeExists = await this.prisma.barangay.findFirst({
        where: { code: data.code },
      });

      if (codeExists) {
        throw new ValidationError('Barangay code already exists');
      }
    }

    // Extract emergency contacts from data
    const { emergencyContacts, ...barangayData } = data;

    // If emergency contacts are provided, replace all existing contacts
    if (emergencyContacts !== undefined) {
      // Delete existing emergency contacts
      await this.prisma.emergencyContact.deleteMany({
        where: { barangayId: id },
      });
    }

    const barangay = await this.prisma.barangay.update({
      where: { id },
      data: {
        ...barangayData,
        emergencyContacts: emergencyContacts
          ? {
              create: emergencyContacts.map((contact) => ({
                name: contact.name,
                phone: contact.phone,
                type: contact.type,
                isPrimary: contact.isPrimary || false,
              })),
            }
          : undefined,
      },
      include: {
        emergencyContacts: true,
      },
    });

    return barangay;
  }

  async deleteBarangay(id: string) {
    const existing = await this.prisma.barangay.findUnique({
      where: { id },
      include: {
        _count: {
          select: { incidents: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('Barangay not found');
    }

    // Check if barangay has incidents
    if (existing._count.incidents > 0) {
      throw new ValidationError(
        'Cannot delete barangay with existing incidents. Please archive instead.'
      );
    }

    await this.prisma.barangay.delete({
      where: { id },
    });

    return { id };
  }

  async getNearbyBarangays(query: NearbyQuery) {
    const radiusKm = query.radiusKm || 10; // Default 10km radius
    const { latitude, longitude } = query;

    // Calculate bounding box for initial filter (approximate)
    const latDelta = radiusKm / 111; // 1 degree latitude ≈ 111 km
    const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

    const barangays = await this.prisma.barangay.findMany({
      where: {
        isActive: true,
        latitude: {
          gte: latitude - latDelta,
          lte: latitude + latDelta,
        },
        longitude: {
          gte: longitude - lonDelta,
          lte: longitude + lonDelta,
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        latitude: true,
        longitude: true,
        contactPerson: true,
        contactPhone: true,
        address: true,
      },
    });

    // Calculate actual distance using Haversine formula
    const barangaysWithDistance = barangays
      .map((b) => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          b.latitude,
          b.longitude
        );

        return {
          ...b,
          distanceKm: Math.round(distance * 100) / 100,
        };
      })
      .filter((b) => b.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return barangaysWithDistance;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula
    const R = 6371; // Earth's radius in km
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

  async getBarangayStats() {
    const [total, active, inactive] = await Promise.all([
      this.prisma.barangay.count(),
      this.prisma.barangay.count({ where: { isActive: true } }),
      this.prisma.barangay.count({ where: { isActive: false } }),
    ]);

    // Get barangays with most incidents
    const topBarangays = await this.prisma.barangay.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { incidents: true },
        },
      },
      orderBy: {
        incidents: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    return {
      total,
      active,
      inactive,
      topBarangays: topBarangays.map((b) => ({
        id: b.id,
        name: b.name,
        incidentCount: b._count.incidents,
      })),
    };
  }
}
