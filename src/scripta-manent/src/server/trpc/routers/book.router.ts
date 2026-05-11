import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { In } from 'typeorm';
import { router, protectedProcedure } from '../init';
import { BookEntity } from '@/server/db/entities/book.entity';
import { GenreEntity } from '@/server/db/entities/genre.entity';
import { TagEntity } from '@/server/db/entities/tag.entity';
import { BookAuthorEntity } from '@/server/db/entities/book-author.entity';
import {
  PaginationSchema,
  BookFiltersSchema,
  BookCreateSchema,
  BookUpdateSchema,
} from '../schemas/book.schema';
import {
  type BookListItemDto,
  type BookDetailDto,
  type PaginatedResult,
} from '../dto/book.dto';

// ─────────────────────────── mapping helpers ─────────────────────────────────

function mapToListItem(book: BookEntity): BookListItemDto {
  const authors = (book.bookAuthors ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ba) => ({
      id:          ba.author.id,
      name:        ba.author.name,
      nationality: ba.author.nationality,
      role:        ba.role,
      sortOrder:   ba.sortOrder,
    }));

  return {
    id:        book.id,
    title:     book.title,
    subtitle:  book.subtitle,
    coverUrl:  book.coverUrl,
    yearRead:  book.yearRead,
    rating:    book.rating,
    authors,
    genres: (book.genres ?? []).map((g) => ({
      id:   g.id,
      name: g.name,
      slug: g.slug,
    })),
    tags: (book.tags ?? []).map((t) => ({
      id:    t.id,
      name:  t.name,
      slug:  t.slug,
      color: t.color,
    })),
    createdAt: book.createdAt.toISOString(),
  };
}

function mapToDetail(book: BookEntity): BookDetailDto {
  return {
    ...mapToListItem(book),
    isbn:          book.isbn,
    publisher:     book.publisher,
    publishedYear: book.publishedYear,
    language:      book.language,
    pages:         book.pages,
    description:   book.description,
    notes:         book.notes,
    updatedAt:     book.updatedAt.toISOString(),
  };
}

// ─────────────────────────── router ──────────────────────────────────────────

export const bookRouter = router({
  /**
   * Lista paginata con filtri combinati.
   */
  list: protectedProcedure
    .input(PaginationSchema.merge(BookFiltersSchema))
    .query(async ({ ctx, input }): Promise<PaginatedResult<BookListItemDto>> => {
      const userId = ctx.session.user.id as string;
      const db     = ctx.db;

      const qb = db
        .getRepository(BookEntity)
        .createQueryBuilder('book')
        .leftJoinAndSelect('book.bookAuthors', 'ba')
        .leftJoinAndSelect('ba.author', 'author')
        .leftJoinAndSelect('book.genres', 'genre')
        .leftJoinAndSelect('book.tags', 'tag')
        .where('book.user_id = :userId', { userId });

      // ── Filtro status ──────────────────────────────────────────────────────
      if (input.status === 'read') qb.andWhere('book.year_read IS NOT NULL');
      if (input.status === 'tbr')  qb.andWhere('book.year_read IS NULL');

      // ── Filtro generi ──────────────────────────────────────────────────────
      if (input.genreIds?.length) {
        qb.andWhere('genre.id IN (:...genreIds)', { genreIds: input.genreIds });
      }

      // ── Filtro tag ─────────────────────────────────────────────────────────
      if (input.tagIds?.length) {
        qb.andWhere('tag.id IN (:...tagIds)', { tagIds: input.tagIds });
      }

      // ── Filtro rating ──────────────────────────────────────────────────────
      if (input.ratingMin != null) {
        qb.andWhere('book.rating >= :ratingMin', { ratingMin: input.ratingMin });
      }

      // ── Filtro anno lettura ────────────────────────────────────────────────
      if (input.yearReadFrom != null) {
        qb.andWhere('book.year_read >= :yearReadFrom', { yearReadFrom: input.yearReadFrom });
      }
      if (input.yearReadTo != null) {
        qb.andWhere('book.year_read <= :yearReadTo', { yearReadTo: input.yearReadTo });
      }

      // ── Full-text search ───────────────────────────────────────────────────
      if (input.q) {
        qb.andWhere(
          `(
            similarity(f_unaccent(book.title), f_unaccent(:q)) > 0.1
            OR f_unaccent(book.title) ILIKE :qLike
            OR similarity(f_unaccent(author.name), f_unaccent(:q)) > 0.2
          )`,
          { q: input.q, qLike: `%${input.q}%` },
        );
      }

      // ── Ordinamento ────────────────────────────────────────────────────────
      const dir = input.sortDir.toUpperCase() as 'ASC' | 'DESC';

      if (input.sortBy === 'author') {
        // Subquery per prendere solo l'autore primario (sort_order = 0)
        qb.orderBy(
          `(SELECT a_s.name
            FROM book_authors ba_s
            JOIN authors a_s ON a_s.id = ba_s.author_id
            WHERE ba_s.book_id = book.id
            ORDER BY ba_s.sort_order ASC
            LIMIT 1)`,
          dir,
        );
      } else {
        const sortMap: Record<string, string> = {
          title:     'book.title',
          yearRead:  'book.year_read',
          rating:    'book.rating',
          createdAt: 'book.created_at',
        };
        qb.orderBy(sortMap[input.sortBy] ?? 'book.created_at', dir);
      }

      const [books, total] = await qb
        .skip((input.page - 1) * input.limit)
        .take(input.limit)
        .getManyAndCount();

      return {
        data:       books.map(mapToListItem),
        total,
        page:       input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  /**
   * Dettaglio libro con tutte le relazioni.
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<BookDetailDto> => {
      const userId = ctx.session.user.id as string;
      const repo   = ctx.db.getRepository(BookEntity);

      const book = await repo.findOne({
        where:     { id: input.id },
        relations: {
          bookAuthors: { author: true },
          genres:      true,
          tags:        true,
        },
      });

      if (!book || book.userId !== userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Libro non trovato' });
      }

      return mapToDetail(book);
    }),

  /**
   * Crea un nuovo libro con autori, generi e tag.
   * Atomico: usa db.transaction().
   */
  create: protectedProcedure
    .input(BookCreateSchema)
    .mutation(async ({ ctx, input }): Promise<BookDetailDto> => {
      const userId = ctx.session.user.id as string;
      const db     = ctx.db;

      const result = await db.transaction(async (em) => {
        // 1. Carica generi
        const genres = input.genreIds.length > 0
          ? await em.getRepository(GenreEntity).findBy({ id: In(input.genreIds) })
          : [];

        // 2. Carica tag (solo quelli dell'utente corrente)
        const tags = input.tagIds.length > 0
          ? await em.getRepository(TagEntity).findBy({ id: In(input.tagIds), userId })
          : [];

        // 3. Crea il libro
        const bookRepo = em.getRepository(BookEntity);
        const book     = bookRepo.create({
          userId,
          title:         input.title,
          subtitle:      input.subtitle   ?? null,
          isbn:          input.isbn        ?? null,
          publisher:     input.publisher   ?? null,
          publishedYear: input.publishedYear ?? null,
          language:      input.language,
          pages:         input.pages       ?? null,
          description:   input.description ?? null,
          coverUrl:      input.coverUrl    ?? null,
          yearRead:      input.yearRead    ?? null,
          rating:        input.rating      ?? null,
          notes:         input.notes       ?? null,
          genres,
          tags,
        });
        const saved = await bookRepo.save(book);

        // 4. Crea le relazioni book_authors
        const baRepo = em.getRepository(BookAuthorEntity);
        const bookAuthors = input.authors.map((a) =>
          baRepo.create({
            bookId:    saved.id,
            authorId:  a.authorId,
            role:      a.role,
            sortOrder: a.sortOrder,
          }),
        );
        await baRepo.save(bookAuthors);

        // 5. Ricarica con tutte le relazioni per il DTO finale
        const full = await em.getRepository(BookEntity).findOneOrFail({
          where:     { id: saved.id },
          relations: {
            bookAuthors: { author: true },
            genres:      true,
            tags:        true,
          },
        });

        return full;
      });

      return mapToDetail(result);
    }),

  /**
   * Aggiorna un libro esistente.
   * Atomico: usa db.transaction().
   */
  update: protectedProcedure
    .input(BookUpdateSchema)
    .mutation(async ({ ctx, input }): Promise<BookDetailDto> => {
      const userId = ctx.session.user.id as string;
      const db     = ctx.db;

      const result = await db.transaction(async (em) => {
        const bookRepo = em.getRepository(BookEntity);

        // 1. Trova il libro verificando l'ownership
        const book = await bookRepo.findOne({
          where:     { id: input.id },
          relations: {
            bookAuthors: { author: true },
            genres:      true,
            tags:        true,
          },
        });
        if (!book || book.userId !== userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Libro non trovato' });
        }

        // 2. Aggiorna i campi scalari (solo quelli esplicitamente forniti)
        if (input.title         !== undefined) book.title         = input.title;
        if (input.subtitle      !== undefined) book.subtitle      = input.subtitle      ?? null;
        if (input.isbn          !== undefined) book.isbn          = input.isbn          ?? null;
        if (input.publisher     !== undefined) book.publisher     = input.publisher     ?? null;
        if (input.publishedYear !== undefined) book.publishedYear = input.publishedYear ?? null;
        if (input.language      !== undefined) book.language      = input.language;
        if (input.pages         !== undefined) book.pages         = input.pages         ?? null;
        if (input.description   !== undefined) book.description   = input.description   ?? null;
        if (input.coverUrl      !== undefined) book.coverUrl      = input.coverUrl      ?? null;
        if (input.yearRead      !== undefined) book.yearRead      = input.yearRead      ?? null;
        if (input.rating        !== undefined) book.rating        = input.rating        ?? null;
        if (input.notes         !== undefined) book.notes         = input.notes         ?? null;

        // 3. Aggiorna generi
        if (input.genreIds !== undefined) {
          book.genres = input.genreIds.length > 0
            ? await em.getRepository(GenreEntity).findBy({ id: In(input.genreIds) })
            : [];
        }

        // 4. Aggiorna tag
        if (input.tagIds !== undefined) {
          book.tags = input.tagIds.length > 0
            ? await em.getRepository(TagEntity).findBy({ id: In(input.tagIds), userId })
            : [];
        }

        await bookRepo.save(book);

        // 5. Aggiorna BookAuthorEntity (delete + re-insert) se forniti
        if (input.authors !== undefined) {
          const baRepo = em.getRepository(BookAuthorEntity);
          await baRepo.delete({ bookId: book.id });

          const bookAuthors = input.authors.map((a) =>
            baRepo.create({
              bookId:    book.id,
              authorId:  a.authorId,
              role:      a.role,
              sortOrder: a.sortOrder,
            }),
          );
          await baRepo.save(bookAuthors);
        }

        // 6. Ricarica con tutte le relazioni per il DTO finale
        return em.getRepository(BookEntity).findOneOrFail({
          where:     { id: book.id },
          relations: {
            bookAuthors: { author: true },
            genres:      true,
            tags:        true,
          },
        });
      });

      return mapToDetail(result);
    }),

  /**
   * Elimina un libro (CASCADE pulisce book_authors, book_genres, book_tags).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const repo   = ctx.db.getRepository(BookEntity);

      const book = await repo.findOne({ where: { id: input.id, userId } });
      if (!book) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Libro non trovato' });
      }

      await repo.remove(book);
      return { deleted: input.id };
    }),
});
