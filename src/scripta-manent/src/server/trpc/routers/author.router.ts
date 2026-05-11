import { TRPCError } from '@trpc/server';
import { ILike } from 'typeorm';
import { router, protectedProcedure } from '../init';
import { AuthorEntity } from '@/server/db/entities/author.entity';
import { AuthorCreateSchema, AuthorSearchSchema } from '../schemas/author.schema';

export const authorRouter = router({
  /**
   * Restituisce tutti gli autori ordinati per nome.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const repo = ctx.db.getRepository(AuthorEntity);
    const authors = await repo.find({ order: { name: 'ASC' } });
    return authors.map((a) => ({
      id:          a.id,
      name:        a.name,
      nationality: a.nationality,
      bio:         a.bio,
    }));
  }),

  /**
   * Ricerca fuzzy per nome autore tramite pg_trgm.
   * Usa f_unaccent per ignorare gli accenti.
   */
  search: protectedProcedure
    .input(AuthorSearchSchema)
    .query(async ({ ctx, input }) => {
      type RawAuthor = { id: string; name: string; nationality: string | null; bio: string | null };
      const results: RawAuthor[] = await ctx.db.query(
        `SELECT id, name, nationality, bio
         FROM authors
         WHERE similarity(f_unaccent(name), f_unaccent($1)) > 0.2
            OR f_unaccent(name) ILIKE $2
         ORDER BY similarity(f_unaccent(name), f_unaccent($1)) DESC
         LIMIT $3`,
        [input.q, `%${input.q}%`, input.limit],
      );
      return results.map((a) => ({
        id:          a.id,
        name:        a.name,
        nationality: a.nationality,
        bio:         a.bio,
      }));
    }),

  /**
   * Crea un nuovo autore.
   * Verifica unicità del nome (case-insensitive).
   */
  create: protectedProcedure
    .input(AuthorCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const repo = ctx.db.getRepository(AuthorEntity);

      const existing = await repo.findOne({
        where: { name: ILike(input.name) },
      });
      if (existing) {
        throw new TRPCError({
          code:    'CONFLICT',
          message: `Autore "${input.name}" già esistente (id: ${existing.id})`,
        });
      }

      const author = repo.create({
        name:        input.name,
        nationality: input.nationality ?? null,
        bio:         input.bio ?? null,
        aliases:     [],
      });
      const saved = await repo.save(author);

      return {
        id:          saved.id,
        name:        saved.name,
        nationality: saved.nationality,
        bio:         saved.bio,
      };
    }),
});
