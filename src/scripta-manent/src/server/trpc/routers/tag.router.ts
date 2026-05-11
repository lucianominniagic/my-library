import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../init';
import { TagEntity } from '@/server/db/entities/tag.entity';
import { BookEntity } from '@/server/db/entities/book.entity';
import { TagCreateSchema, TagAttachSchema } from '../schemas/tag.schema';

// ─────────────────────────── helpers ────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─────────────────────────── router ─────────────────────────────────────────

export const tagRouter = router({
  /**
   * Restituisce i tag dell'utente corrente con il conteggio dei libri associati.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id as string;
    const repo   = ctx.db.getRepository(TagEntity);

    const tags = (await repo
      .createQueryBuilder('tag')
      .loadRelationCountAndMap('tag.bookCount', 'tag.books', 'book')
      .where('tag.user_id = :userId', { userId })
      .orderBy('tag.name', 'ASC')
      .getMany()) as (TagEntity & { bookCount: number })[];

    return tags.map((t) => ({
      id:        t.id,
      name:      t.name,
      slug:      t.slug,
      color:     t.color,
      bookCount: t.bookCount ?? 0,
    }));
  }),

  /**
   * Crea un nuovo tag per l'utente.
   * Normalizza il nome (trim), genera lo slug, verifica unicità per userId.
   */
  create: protectedProcedure
    .input(TagCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const repo   = ctx.db.getRepository(TagEntity);
      const slug   = toSlug(input.name);

      const existing = await repo.findOne({ where: { userId, slug } });
      if (existing) {
        throw new TRPCError({
          code:    'CONFLICT',
          message: `Tag "${input.name}" già esistente per questo utente`,
        });
      }

      const tag = repo.create({
        userId,
        name:  input.name.trim(),
        slug,
        color: input.color ?? null,
      });
      const saved = await repo.save(tag);

      return {
        id:    saved.id,
        name:  saved.name,
        slug:  saved.slug,
        color: saved.color,
      };
    }),

  /**
   * Rinomina un tag (aggiorna name e slug).
   * Verifica unicità del nuovo slug per l'utente.
   */
  rename: protectedProcedure
    .input(z.object({
      id:   z.string().uuid(),
      name: z.string().min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const repo   = ctx.db.getRepository(TagEntity);

      const tag = await repo.findOne({ where: { id: input.id, userId } });
      if (!tag) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tag non trovato' });
      }

      const newSlug = toSlug(input.name);
      if (newSlug !== tag.slug) {
        const conflict = await repo.findOne({ where: { userId, slug: newSlug } });
        if (conflict) {
          throw new TRPCError({
            code:    'CONFLICT',
            message: `Un tag con il nome "${input.name}" già esiste`,
          });
        }
      }

      tag.name = input.name.trim();
      tag.slug = newSlug;
      const saved = await repo.save(tag);

      return {
        id:   saved.id,
        name: saved.name,
        slug: saved.slug,
      };
    }),

  /**
   * Elimina un tag (CASCADE su book_tags).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const repo   = ctx.db.getRepository(TagEntity);

      const tag = await repo.findOne({ where: { id: input.id, userId } });
      if (!tag) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tag non trovato' });
      }

      await repo.remove(tag);
      return { deleted: input.id };
    }),

  /**
   * Associa/disassocia tag a un libro.
   * - set    → sostituisce tutti i tag del libro
   * - add    → aggiunge i tagIds ai tag esistenti
   * - remove → rimuove i tagIds dai tag esistenti
   */
  attach: protectedProcedure
    .input(TagAttachSchema)
    .mutation(async ({ ctx, input }) => {
      const userId   = ctx.session.user.id as string;
      const bookRepo = ctx.db.getRepository(BookEntity);
      const tagRepo  = ctx.db.getRepository(TagEntity);

      const book = await bookRepo.findOne({
        where:     { id: input.bookId, userId },
        relations: { tags: true },
      });
      if (!book) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Libro non trovato' });
      }

      // Carica i tag da operare
      const targetTags = input.tagIds.length > 0
        ? await tagRepo
            .createQueryBuilder('tag')
            .where('tag.id IN (:...ids)', { ids: input.tagIds })
            .andWhere('tag.user_id = :userId', { userId })
            .getMany()
        : [];

      switch (input.mode) {
        case 'set': {
          book.tags = targetTags;
          break;
        }
        case 'add': {
          const existingIds = new Set(book.tags.map((t) => t.id));
          for (const t of targetTags) {
            if (!existingIds.has(t.id)) book.tags.push(t);
          }
          break;
        }
        case 'remove': {
          const removeIds = new Set(input.tagIds);
          book.tags = book.tags.filter((t) => !removeIds.has(t.id));
          break;
        }
      }

      await bookRepo.save(book);
      return { bookId: book.id, tagCount: book.tags.length };
    }),
});
