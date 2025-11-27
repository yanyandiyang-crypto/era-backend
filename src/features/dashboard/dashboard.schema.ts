import { z } from 'zod';

export const timeRangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'year']).optional(),
});
