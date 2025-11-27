import { z } from 'zod';
import { AuditAction } from './audit.types';

export const auditLogQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  userId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
