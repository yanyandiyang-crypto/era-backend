import { z } from 'zod';
import { IncidentType } from '@prisma/client';

// OWASP A03/V5: Enhanced input validation with strict bounds and patterns
export const createPublicIncidentSchema = z.object({
  type: z.nativeEnum(IncidentType),
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .refine(
      (val) => val.trim().length >= 20,
      'Description cannot be only whitespace'
    ),
  latitude: z.number()
    .min(-90, 'Invalid latitude: must be between -90 and 90')
    .max(90, 'Invalid latitude: must be between -90 and 90')
    .refine((val) => !isNaN(val), 'Latitude must be a valid number')
    .refine((val) => Math.abs(val) <= 90, 'Latitude out of bounds'),
  longitude: z.number()
    .min(-180, 'Invalid longitude: must be between -180 and 180')
    .max(180, 'Invalid longitude: must be between -180 and 180')
    .refine((val) => !isNaN(val), 'Longitude must be a valid number')
    .refine((val) => Math.abs(val) <= 180, 'Longitude out of bounds'),
  address: z.string()
    .min(10, 'Address must be at least 10 characters')
    .max(500, 'Address cannot exceed 500 characters')
    .refine(
      (val) => !/[<>{}\\]/.test(val),
      'Address contains invalid characters'
    ),
  reporterName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s\-'.]+$/, 'Name contains invalid characters. Only letters, spaces, hyphens, apostrophes, and periods allowed'),
  reporterPhone: z.string()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number format. Must be 7-15 digits, optional + prefix')
    .refine(
      (val) => val.replace(/[^0-9]/g, '').length >= 7,
      'Phone number must contain at least 7 digits'
    ),
  landmark: z.string()
    .max(200, 'Landmark cannot exceed 200 characters')
    .optional()
    .refine(
      (val) => !val || !/[<>{}]/.test(val),
      'Landmark contains invalid characters'
    ),
  sessionToken: z.string()
    .uuid('Invalid session token format'),
});

export const createPublicSessionSchema = z.object({
  userAgent: z.string().optional(),
});

export const getPublicIncidentsSchema = z.object({
  type: z.nativeEnum(IncidentType).optional(),
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
});

export type CreatePublicIncidentInput = z.infer<typeof createPublicIncidentSchema>;
export type CreatePublicSessionInput = z.infer<typeof createPublicSessionSchema>;
export type GetPublicIncidentsInput = z.infer<typeof getPublicIncidentsSchema>;
