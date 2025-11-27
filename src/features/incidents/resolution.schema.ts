import { z } from 'zod';
import { ResolutionOutcome } from '@prisma/client';

export const submitResolutionSchema = z.object({
  what: z.string().min(1, 'What happened is required'),
  when: z.string().min(1, 'When is required'),
  where: z.string().min(1, 'Where is required'),
  who: z.string().min(1, 'Who is required'),
  why: z.string().min(1, 'Why is required'),
  how: z.nativeEnum(ResolutionOutcome, { required_error: 'Resolution outcome is required' }),
  notes: z.union([z.string(), z.null()]).optional(),
  personnelId: z.string(),
});

export const updateResolutionSchema = z.object({
  what: z.string().optional(),
  when: z.string().optional(),
  where: z.string().optional(),
  who: z.string().optional(),
  why: z.string().optional(),
  how: z.nativeEnum(ResolutionOutcome).optional(),
  notes: z.union([z.string(), z.null()]).optional(),
  adminNotes: z.string().optional(),
});

export const confirmResolutionSchema = z.object({
  adminNotes: z.string().optional(),
});
