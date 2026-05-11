# ADR-001: Book Schema — Nessuna entità Reading separata

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** Gibson (Architect), Shakespeare (DB), McCarthy (Backend)
- **Supersedes:** Decisione brainstorming "Reading come entità separata"

---

## Context

Durante il brainstorming Shakespeare aveva proposto una tabella `readings` separata
(un record per ogni lettura: `year_read`, `rating`, `notes`) per supportare le **reletture**
— caso d'uso comune in app tipo Goodreads.

Luciano ha chiarito che:
1. **Le reletture NON sono tracciate** — ogni libro ha al massimo una data di lettura e un voto.
2. **I libri "da leggere" (TBR)** non richiedono un'entità separata: `year_read IS NULL` è sufficiente.

### Opzioni valutate

| Opzione | Pro | Contro |
|---|---|---|
| A — Tabella `readings` separata | Supporta reletture future | Join obbligatorio per ogni query, schema più complesso |
| **B — Campi su `Book`** (scelta) | Schema semplice, nessun join per rating/year | Reletture non tracciabili (accettato) |
| C — Entità `ReadStatus` (enum) | Semantica esplicita | Rigido, non porta anno né voto |

---

## Decision

**Opzione B.** `year_read` e `rating` vanno direttamente sulla tabella `books`.
La tabella `readings` non viene creata.

---

## Schema risultante

```sql
-- Aggiunto alla tabella books:
year_read   SMALLINT    NULL,         -- NULL = da leggere (TBR)
rating      SMALLINT    NULL
              CHECK (rating BETWEEN 1 AND 5),
notes       TEXT        NULL          -- campo libero (impressioni, citazioni)
```

### Semantica `year_read`

| Valore | Significato |
|---|---|
| `NULL` | Libro in wishlist / TBR |
| `2023` | Letto nel 2023 |

### Query TBR (gratis, senza join)

```sql
SELECT * FROM books WHERE year_read IS NULL ORDER BY title;
```

### Indici

```sql
CREATE INDEX idx_books_year_read ON books (year_read) WHERE year_read IS NOT NULL;
CREATE INDEX idx_books_rating    ON books (rating)    WHERE rating IS NOT NULL;
```

---

## Consequences

### Positive
- Schema più semplice: una tabella in meno, nessun join per le query di lista.
- tRPC routers semplificati: `book.update` gestisce anno e voto inline.
- Rating visibile in lista senza JOIN aggiuntivo.
- TBR list è un filtro URL gratuito: `?read=false`.

### Negative
- Reletture non tracciabili (accettato esplicitamente da Luciano).
- Se in futuro si vuole supportare reletture, serve una migration `ALTER TABLE` + nuova entità.
  Mitigazione: aggiungere `reading_count SMALLINT DEFAULT 1` ora non rompe nulla.

---

## Evolution path (se cambia il requisito)

```sql
-- Migration futura (non pianificata):
CREATE TABLE readings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id   UUID REFERENCES books(id) ON DELETE CASCADE,
  year_read SMALLINT NOT NULL,
  rating    SMALLINT CHECK (rating BETWEEN 1 AND 5),
  notes     TEXT,
  PRIMARY KEY (id)
);
-- Migrare year_read/rating da books a readings con INSERT INTO readings SELECT ...
-- Poi DROP COLUMN year_read, rating da books
```
