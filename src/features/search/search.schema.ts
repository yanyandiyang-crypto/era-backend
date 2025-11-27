import { z } from 'zod';
import { SearchEntity } from './search.types';

export const searchQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required').max(200),
  entity: z.nativeEnum(SearchEntity).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  type: z.string().optional(),
  role: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  sortField: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
});
