import { z } from 'zod';

export const updateCaptionSchema = z.object({
  caption: z.string().min(1, 'Caption cannot be empty'),
});
