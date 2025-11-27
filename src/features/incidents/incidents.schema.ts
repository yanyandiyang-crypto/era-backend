import { z } from 'zod';
import { IncidentStatus, IncidentPriority, IncidentType } from '@prisma/client';

export const createIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  type: z.nativeEnum(IncidentType),
  priority: z.nativeEnum(IncidentPriority),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(1, 'Address is required'),
  reporterName: z.string().min(1, 'Reporter name is required'),
  reporterPhone: z.string().min(1, 'Reporter phone is required'),
  barangayId: z.string().optional(),
});

export const updateIncidentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: z.nativeEnum(IncidentType).optional(),
  priority: z.nativeEnum(IncidentPriority).optional(),
  status: z.nativeEnum(IncidentStatus).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().min(1).optional(),
  reporterName: z.string().min(1).optional(),
  reporterPhone: z.string().min(1).optional(),
  barangayId: z.string().optional(),
});

export const incidentListQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  search: z.string().optional(),
  type: z.string().optional(), // Can be single or comma-separated
  priority: z.string().optional(), // Can be single or comma-separated
  status: z.string().optional(), // Can be single or comma-separated
  barangayId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const assignPersonnelSchema = z.object({
  personnelIds: z.array(z.string()).min(1, 'At least one personnel must be assigned'),
});

export const addUpdateSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  updateType: z.enum(['INFO', 'STATUS_CHANGE', 'PERSONNEL_ASSIGNED', 'RESOLVED']),
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(IncidentStatus),
  notes: z.string().optional(),
  priority: z.nativeEnum(IncidentPriority).optional(),
});
