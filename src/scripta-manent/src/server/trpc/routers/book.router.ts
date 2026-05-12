import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { In } from 'typeorm';
import { router, protectedProcedure } from '../init';
import { BookEntity, GenreEntity, TagEntity, BookAuthorEntity } from '@/server/db/entities';
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
import { fetchCoverUrl } from '../services/google-books.service';

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
    titleEn:       book.titleEn,
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
   * Lista paginata con filtri combinati — pattern ID-first.
   *
   * ─── PERCHÉ NON getManyAndCount() ────────────────────────────────────────
   * TypeORM 0.3.29 + webpack (Next.js) crasha con:
   *   TypeError: Cannot read properties of undefined (reading 'databaseName')
   * ogni volta che getManyAndCount() incontra relazioni ManyToMany (genres,
   * tags) in un QueryBuilder con skip/take. Il bug è nella logica interna di
   * TypeORM che, sotto webpack, perde i metadati delle junction-table entity
   * durante la serializzazione del bundle. Aggiungere BookGenreEntity e
   * BookTagEntity esplicite nel DataSource non risolve il problema perché il
   * crash avviene a runtime nel codice ORM, non nella fase di caricamento dei
   * metadati.
   *
   * ─── SOLUZIONE: ID-FIRST PAGINATION ─────────────────────────────────────
   * 1. Un QB "leggero" seleziona solo `book.id`, applica tutti i filtri e
   *    l'ordinamento, esegue COUNT + paginazione con limit/offset.
   *    → Nessuna relazione ManyToMany, nessun crash.
   * 2. Un QB "completo" carica le entità per gli IDs già noti, con tutte le
   *    relazioni, senza skip/take.
   *    → TypeORM non deve calcolare pagine su un join complesso.
   * 3. Il risultato viene riordinato in base all'array degli IDs per
   *    ripristinare l'ordine perso dalla clausola IN.
   *
   * I filtri su generi e tag usano subquery EXISTS per non influenzare
   * l'idratazione delle relazioni (es. un libro con generi [A,B,C] filtrato
   * per A deve mostrare tutti e tre i generi, non solo A).
   * Il FTS su autore usa join raw sulle tabelle `book_authors`/`authors` perché
   * nel QB leggero non si caricano le relazioni entity.
   */
  list: protectedProcedure
    .input(PaginationSchema.merge(BookFiltersSchema))
    .query(async ({ ctx, input }): Promise<PaginatedResult<BookListItemDto>> => {
      const userId = ctx.session.user.id as string;
      const db     = ctx.db;

      // ── QB leggero: solo IDs + COUNT ──────────────────────────────────────
      const lightQb = db
        .getRepository(BookEntity)
        .createQueryBuilder('book')
        .select('book.id', 'id')
        .where('book.user_id = :userId', { userId });

      // ── Filtro status ──────────────────────────────────────────────────────
      if (input.status === 'read') lightQb.andWhere('book.year_read IS NOT NULL');
      if (input.status === 'tbr')  lightQb.andWhere('book.year_read IS NULL');

      // ── Filtro generi (EXISTS: non tocca i dati idratati) ─────────────────
      if (input.genreIds?.length) {
        lightQb.andWhere(
          `EXISTS (SELECT 1 FROM book_genres bg
                   WHERE bg.book_id = book.id
                     AND bg.genre_id IN (:...genreIds))`,
          { genreIds: input.genreIds },
        );
      }

      // ── Filtro tag (EXISTS: non tocca i dati idratati) ────────────────────
      if (input.tagIds?.length) {
        lightQb.andWhere(
          `EXISTS (SELECT 1 FROM book_tags bt
                   WHERE bt.book_id = book.id
                     AND bt.tag_id IN (:...tagIds))`,
          { tagIds: input.tagIds },
        );
      }

      // ── Filtro rating ──────────────────────────────────────────────────────
      if (input.ratingMin != null) {
        lightQb.andWhere('book.rating >= :ratingMin', { ratingMin: input.ratingMin });
      }

      // ── Filtro anno lettura ────────────────────────────────────────────────
      if (input.yearReadFrom != null) {
        lightQb.andWhere('book.year_read >= :yearReadFrom', { yearReadFrom: input.yearReadFrom });
      }
      if (input.yearReadTo != null) {
        lightQb.andWhere('book.year_read <= :yearReadTo', { yearReadTo: input.yearReadTo });
      }

      // ── Full-text search ───────────────────────────────────────────────────
      // Join raw su book_authors/authors (niente entity-relation nel QB leggero).
      // Il match su autore usa join espliciti per non filtrare le relazioni
      // idratate nel QB completo successivo.
      if (input.q) {
        lightQb
          .leftJoin('book_authors', 'ba_fts', 'ba_fts.book_id = book.id')
          .leftJoin('authors', 'author_fts', 'author_fts.id = ba_fts.author_id')
          .andWhere(
            `(similarity(f_unaccent(book.title), f_unaccent(:q)) > 0.1
              OR f_unaccent(book.title) ILIKE :qLike
              OR similarity(f_unaccent(author_fts.name), f_unaccent(:q)) > 0.2)`,
            { q: input.q, qLike: `%${input.q}%` },
          );
      }

      // ── Ordinamento ────────────────────────────────────────────────────────
      const dir = input.sortDir.toUpperCase() as 'ASC' | 'DESC';

      if (input.sortBy === 'author') {
        // Subquery correlata: autore primario per sort_order ASC.
        // Semanticamente corretto anche con più autori per libro.
        lightQb.orderBy(
          `(SELECT a_s.name FROM book_authors ba_s
            JOIN authors a_s ON a_s.id = ba_s.author_id
            WHERE ba_s.book_id = book.id
            ORDER BY ba_s.sort_order ASC LIMIT 1)`,
          dir,
        );
      } else {
        const sortMap: Record<string, string> = {
          title:     'book.title',
          yearRead:  'book.year_read',
          rating:    'book.rating',
          createdAt: 'book.created_at',
        };
        lightQb.orderBy(sortMap[input.sortBy] ?? 'book.created_at', dir);
      }

      // ── COUNT + IDs paginati ───────────────────────────────────────────────
      const total  = await lightQb.getCount();
      const offset = (input.page - 1) * input.limit;
      const rawIds = await lightQb
        .limit(input.limit)
        .offset(offset)
        .getRawMany<{ id: string }>();
      const ids = rawIds.map((r) => r.id);

      // Pagina vuota: ritorno immediato senza il secondo QB
      if (ids.length === 0) {
        return {
          data:       [],
          total,
          page:       input.page,
          totalPages: Math.ceil(total / input.limit),
        };
      }

      // ── QB completo: fetch delle entity dagli IDs noti ────────────────────
      // Nessun skip/take qui: TypeORM non deve paginate su ManyToMany join.
      const books = await db
        .getRepository(BookEntity)
        .createQueryBuilder('book')
        .leftJoinAndSelect('book.bookAuthors', 'ba')
        .leftJoinAndSelect('ba.author', 'author')
        .leftJoinAndSelect('book.genres', 'genre')
        .leftJoinAndSelect('book.tags', 'tag')
        .where('book.id IN (:...ids)', { ids })
        .getMany();

      // ── Riordino: IN (:...ids) non garantisce l'ordine degli IDs ──────────
      const bookMap = new Map(books.map((b) => [b.id, b]));
      const orderedBooks = ids
        .map((id) => bookMap.get(id))
        .filter((b): b is BookEntity => b !== undefined);

      return {
        data:       orderedBooks.map(mapToListItem),
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
          titleEn:       input.titleEn       ?? null,
          subtitle:      input.subtitle      ?? null,
          isbn:          input.isbn          ?? null,
          publisher:     input.publisher     ?? null,
          publishedYear: input.publishedYear ?? null,
          language:      input.language,
          pages:         input.pages         ?? null,
          description:   input.description   ?? null,
          coverUrl:      input.coverUrl      ?? null,
          yearRead:      input.yearRead      ?? null,
          rating:        input.rating        ?? null,
          notes:         input.notes         ?? null,
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

      // ── Cover fetch (fuori dalla transazione — non bloccante) ──────────────
      // REQ-31: mancanza cover non blocca il salvataggio.
      if (!result.coverUrl) {
        const primaryAuthor = result.bookAuthors?.[0]?.author?.name ?? '';
        try {
          const cover = await fetchCoverUrl({
            titleEn:    input.titleEn,
            titleIt:    input.title,
            authorName: primaryAuthor,
          });
          if (cover) {
            await ctx.db.getRepository(BookEntity).update(result.id, { coverUrl: cover });
            result.coverUrl = cover;
          }
        } catch (err) {
          console.warn('[book.create] Cover fetch non riuscito:', err);
        }
      }

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
        if (input.titleEn       !== undefined) book.titleEn       = input.titleEn       ?? null;
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

      // ── Cover fetch (fuori dalla transazione — non bloccante) ──────────────
      // REQ-31: mancanza cover non blocca l'aggiornamento.
      if (!result.coverUrl && input.coverUrl === undefined) {
        const primaryAuthor = result.bookAuthors?.[0]?.author?.name ?? '';
        try {
          const cover = await fetchCoverUrl({
            titleEn:    input.titleEn ?? result.titleEn,
            titleIt:    result.title,
            authorName: primaryAuthor,
          });
          if (cover) {
            await ctx.db.getRepository(BookEntity).update(result.id, { coverUrl: cover });
            result.coverUrl = cover;
          }
        } catch (err) {
          console.warn('[book.update] Cover fetch non riuscito:', err);
        }
      }

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
