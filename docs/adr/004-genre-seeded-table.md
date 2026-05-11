# ADR-004: Genre — Tabella seeded con vocabolario fisso (sostituisce text[] su Book)

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** Gibson (Architect), Shakespeare (DB), McCarthy (Backend)
- **Supersedes:** Decisione brainstorming "genres text[] con indice GIN su books"

---

## Context

Il brainstorming aveva proposto `genres text[]` sul record `books` con un indice GIN,
assumendo che il vocabolario fosse "semi-fisso". Luciano ha confermato che i generi
sono un **set controllato**: l'utente sceglie da un dropdown, non può inventarne di nuovi.

### Opzioni valutate

| Opzione | Integrità DB | Query filter | UI | Evoluzione |
|---|---|---|---|---|
| A — `text[]` su Book + GIN | ❌ No FK | `@>` array containment (ok) | Autocomplete free-form | Nessuna migration per nuovi generi |
| **B — Tabella `genres` + junction** (scelta) | ✅ FK + UNIQUE | JOIN standard | Dropdown popolato da DB | Migration per aggiungere genere |
| C — Zod enum compile-time | ❌ Solo app layer | — | Dropdown hardcoded | Redeploy per ogni genere nuovo |

---

## Decision

**Opzione B.** Tabella `genres` con vocabolario fisso, seedata in una migration dedicata.
Junction `book_genres` per la relazione M:N.

### Rationale vs brainstorming

- Il confine tra "semi-fisso" e "fisso" è stato chiarito → integrità referenziale vale il join.
- Dropdown UI popolata da `genre.list` tRPC query (non hardcoded nel frontend).
- Zod enum generato dallo stesso file seed → type-safety senza lock-in al compile time.
- Query di filtro più leggibile e sfrutta indici FK normali vs GIN array.

---

## Schema

```sql
CREATE TABLE genres (
  id   SERIAL      PRIMARY KEY,
  name TEXT        UNIQUE NOT NULL,    -- "Fantascienza"
  slug TEXT        UNIQUE NOT NULL     -- "fantascienza"
);

CREATE TABLE book_genres (
  book_id   UUID    NOT NULL REFERENCES books(id)   ON DELETE CASCADE,
  genre_id  INTEGER NOT NULL REFERENCES genres(id)  ON DELETE RESTRICT,
  PRIMARY KEY (book_id, genre_id)
);

CREATE INDEX idx_book_genres_genre_id ON book_genres (genre_id);
```

### Seed migration (estratto dal CSV)

```typescript
// migrations/XXXX-seed-genres.ts
const GENRES = [
  'Narrativa italiana',
  'Narrativa straniera',
  'Fantascienza',
  'Fantasy',
  'Thriller',
  'Giallo',
  'Storico',
  'Saggistica',
  'Biografia',
  'Fumetto / Graphic Novel',
  'Classici',
  'Horror',
  'Romanzo',
  'Avventura',
  'Umorismo',
  'Poesia',
  'Teatro',
  'Filosofia',
  'Psicologia',
  'Economia',
  'Informatica',
  'Scienza',
  'Viaggi',
  'Cucina',
  'Arte',
  'Religione / Spiritualità',
] as const;

export type GenreName = typeof GENRES[number];

// Zod schema derivato dalla stessa costante (single source of truth):
export const GenreNameSchema = z.enum(GENRES);
```

### Query filtro per genere

```sql
SELECT b.*
FROM books b
JOIN book_genres bg ON bg.book_id = b.id
JOIN genres g       ON g.id = bg.genre_id
WHERE g.slug = 'fantascienza'
ORDER BY b.title;
```

### tRPC procedure

```typescript
// genre.router.ts
genreRouter.list = publicProcedure.query(async ({ ctx }) => {
  return ctx.db.find(GenreEntity, { order: { name: 'ASC' } });
});

// book.router.ts — filtro combinato
bookRouter.list = protectedProcedure
  .input(z.object({
    genreSlug: z.string().optional(),
    // ... altri filtri
  }))
  .query(async ({ ctx, input }) => {
    const qb = ctx.db.createQueryBuilder(BookEntity, 'b');
    if (input.genreSlug) {
      qb.innerJoin('b.bookGenres', 'bg')
        .innerJoin('bg.genre', 'g')
        .andWhere('g.slug = :slug', { slug: input.genreSlug });
    }
    // ...
  });
```

---

## TypeORM Entities

```typescript
@Entity('genres')
export class GenreEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) name: string;
  @Column({ unique: true }) slug: string;
  @ManyToMany(() => BookEntity, (b) => b.genres) books: BookEntity[];
}

@Entity('books')
export class BookEntity {
  // ...
  @ManyToMany(() => GenreEntity, (g) => g.books)
  @JoinTable({ name: 'book_genres' })
  genres: GenreEntity[];
}
```

---

## Consequences

### Positive
- Integrità referenziale garantita a livello DB.
- Dropdown UI popolato da DB — aggiungere un genere richiede solo una migration, zero codice frontend.
- Zod enum derivato dalla stessa costante → type-safety end-to-end.
- Query di filtro standard con JOIN, piano di esecuzione prevedibile.

### Negative
- Un join in più rispetto a `text[]` (trascurabile per ~500 libri).
- Aggiungere un genere richiede una migration (accettato: vocabolario fisso, modifiche rare).
- L'import CSV deve mappare stringhe genere → `genre_id` (gestito nello script con lookup table).
