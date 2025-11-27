import { z } from 'zod';
import { PersonnelRole, PersonnelStatus } from '@prisma/client';

export const createPersonnelSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[@$!%*?&]/, 'Password must contain special character'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(1, 'Phone is required'),
  role: z.nativeEnum(PersonnelRole),
  dateOfBirth: z.string().transform((val) => new Date(val)).optional(),
  bloodType: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export const updatePersonnelSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  role: z.nativeEnum(PersonnelRole).optional(),
  status: z.nativeEnum(PersonnelStatus).optional(),
  dateOfBirth: z.string().transform((val) => new Date(val)).optional(),
  bloodType: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  isAvailable: z.boolean().optional(),
  currentDuty: z.string().optional(),
});

export const personnelListQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  search: z.string().optional(),
  role: z.string().optional(), // Accept comma-separated roles
  status: z.string().optional(), // Accept comma-separated statuses
  isAvailable: z.string().transform((val) => val === 'true').pipe(z.boolean()).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[@$!%*?&]/, 'Password must contain special character'),
});

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  altitude: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
});
