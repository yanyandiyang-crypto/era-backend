import { z } from 'zod';

const emergencyContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  type: z.enum(['EMERGENCY', 'BARANGAY_HALL', 'POLICE', 'FIRE', 'MEDICAL', 'OTHER']),
  isPrimary: z.boolean().optional(),
});

export const createBarangaySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude'),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  emergencyContacts: z.array(emergencyContactSchema).optional(),
  operatingHours: z.string().optional(),
  landmarks: z.string().optional(),
});

export const updateBarangaySchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
  emergencyContacts: z.array(emergencyContactSchema).optional(),
  operatingHours: z.string().optional(),
  landmarks: z.string().optional(),
});

export const barangayListQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  search: z.string().optional(),
  isActive: z.string().transform((val) => val === 'true').pipe(z.boolean()).optional(),
});

export const nearbyQuerySchema = z.object({
  latitude: z.string().transform(Number).pipe(z.number().min(-90).max(90)),
  longitude: z.string().transform(Number).pipe(z.number().min(-180).max(180)),
  radiusKm: z.string().transform(Number).pipe(z.number().min(0.1).max(100)).optional(),
});
