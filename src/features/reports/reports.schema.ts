import { z } from 'zod';
import { ReportType } from './reports.types';

export const generateReportSchema = z.object({
  type: z.nativeEnum(ReportType),
  title: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  incidentId: z.string().uuid().optional(),
  personnelId: z.string().uuid().optional(),
  barangayId: z.string().uuid().optional(),
  includePhotos: z.boolean().optional(),
  includeTimeline: z.boolean().optional(),
  includeStatistics: z.boolean().optional(),
});
