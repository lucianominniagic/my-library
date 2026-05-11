import { z } from 'zod';

export const TagCreateSchema = z.object({
  name:  z.string().min(1).max(50).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const TagAttachSchema = z.object({
  bookId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()),
  mode:   z.enum(['set', 'add', 'remove']).default('set'),
});
