import { z } from 'zod';

export const PaginationSchema = z.object({
  page:  z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
});

export const BookFiltersSchema = z.object({
  q:            z.string().optional(),
  genreIds:     z.array(z.string().uuid()).optional(),
  tagIds:       z.array(z.string().uuid()).optional(),
  ratingMin:    z.number().int().min(1).max(5).optional(),
  yearReadFrom: z.number().int().optional(),
  yearReadTo:   z.number().int().optional(),
  status:       z.enum(['all', 'read', 'tbr']).default('all'),
  sortBy:       z.enum(['title', 'author', 'yearRead', 'rating', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortDir:      z.enum(['asc', 'desc']).default('desc'),
});

export const BookCreateSchema = z.object({
  title:         z.string().min(1).max(500),
  titleEn:       z.string().max(500).optional(),
  subtitle:      z.string().max(500).optional(),
  isbn:          z.string().optional(),
  publisher:     z.string().optional(),
  publishedYear: z.number().int().min(0).max(2200).optional(),
  language:      z.string().min(2).max(2).default('it'),
  pages:         z.number().int().min(1).optional(),
  description:   z.string().optional(),
  coverUrl:      z.union([z.string().url(), z.string().regex(/^\/covers\//)]).optional(),
  yearRead:      z.number().int().min(1800).max(2200).optional(),
  rating:        z.number().int().min(1).max(5).optional(),
  notes:         z.string().optional(),
  authors: z.array(z.object({
    authorId:  z.string().uuid(),
    role:      z.enum(['author', 'editor', 'translator', 'illustrator', 'other']).default('author'),
    sortOrder: z.number().int().default(0),
  })).min(1, 'Almeno un autore è richiesto'),
  genreIds: z.array(z.string().uuid()).default([]),
  tagIds:   z.array(z.string().uuid()).default([]),
});

export const BookUpdateSchema = BookCreateSchema.partial().extend({
  id: z.string().uuid(),
  // Campi nullable: null = cancellazione esplicita del valore; undefined = campo non toccato
  subtitle:      z.string().max(500).trim().nullable().optional(),
  isbn:          z.string().trim().nullable().optional(),
  publisher:     z.string().trim().nullable().optional(),
  publishedYear: z.number().int().min(0).max(2200).nullable().optional(),
  pages:         z.number().int().min(1).nullable().optional(),
  description:   z.string().trim().nullable().optional(),
  titleEn:       z.string().max(500).trim().nullable().optional(),
  coverUrl:      z.union([z.string().url(), z.string().regex(/^\/covers\//), z.null()]).optional(),
  yearRead:      z.number().int().min(1800).max(2200).nullable().optional(),
  rating:        z.number().int().min(1).max(5).nullable().optional(),
  notes:         z.string().trim().nullable().optional(),
});
