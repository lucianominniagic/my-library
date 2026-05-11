import { z } from 'zod';

export const AuthorCreateSchema = z.object({
  name:        z.string().min(1).max(255),
  nationality: z.string().optional(),
  bio:         z.string().optional(),
});

export const AuthorSearchSchema = z.object({
  q:     z.string().min(1),
  limit: z.number().int().min(1).max(20).default(10),
});
