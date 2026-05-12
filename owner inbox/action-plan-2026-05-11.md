# 🗺️ Scripta Manent — Piano d'Azione

**Data:** 2026-05-11 | **Autori:** Gibson (Architect) + Dick (BA) + Shakespeare (DB)
**Aggiornato:** 2026-05-12 | Fase 6 completata · ADR-002 rivisto · ADR-005 aggiunto

---

## ADR — Architecture Decision Records

### ADR-001 · Schema Book semplificato
**Decisione:** `year_read` (nullable) e `rating` (nullable 1-5) direttamente su `Book`.
- Tabella `readings` **eliminata**
- `year_read IS NULL` = TBR | `year_read NOT NULL` = Letto
- Evolution path: migration semplice e non distruttiva se in futuro servono reletture

### ADR-002 · Google Books API — Cover URL *(rivisto 2026-05-12)*
**Decisione:** fetch **server-side** al salvataggio, URL salvata in `cover_url TEXT`.
- ~~ISBN lookup~~ **eliminato**: Luciano non dispone degli ISBN
- **Waterfall:** `title_en + autore` → `title_it + autore` → `null` (placeholder UI)
- Nessun `langRestrict`: evita di escludere libri italiani con metadati incompleti in Google Books
- `https://` forzato (Google restituisce `http://`)
- Timeout 5s per richiesta (`AbortSignal.timeout(5000)`)
- Errori API non bloccano il salvataggio (REQ-31)
- Import CSV: flag `--no-covers` ancora supportato per disabilitare fetch

### ADR-005 · Campo `title_en` su Book *(aggiunto 2026-05-12)*
**Decisione:** aggiunto campo `title_en TEXT NULLABLE` alla tabella `books` (migration `004_AddTitleEn`).
- **Rationale:** i libri italiani hanno spesso titoli diversi in inglese; Google Books ha copertura migliore con titoli in inglese
- Campo opzionale nel form — nessuna validazione required
- Helper text nel form: *"Aiuta a trovare la copertina su Google Books"*
- Se compilato, viene usato come primo tentativo nel waterfall cover
- `BookDetailDto` espone `titleEn: string | null`

### ADR-003 · Auth — next-auth v5 Credentials + JWT
**Decisione:** `CredentialsProvider` (email + password), sessione JWT 30 giorni.
- `bcryptjs` cost factor 12
- Utente creato via `scripts/seed-user.ts` da env vars (no UI registrazione)
- `src/middleware.ts` protegge tutto tranne `/login` e `/api/auth/**`

### ADR-004 · Genre — Tabella seeded (non `text[]`)
**Decisione:** tabella `genres` + junction `book_genres` (integrità referenziale DB-level).
- Single source of truth: costante `GENRES[]` → seed migration + `z.enum(GENRES)` Zod
- Dropdown popolata da `genre.list` tRPC (non hardcoded in UI)

---

## Piano di Sviluppo a Fasi

| Fase | Titolo | Lead | Dipende da | Deliverable |
|---|---|---|---|---|
| **0** | Foundation | Pasolini | — | Repo, Docker Compose (PG), DataSource singleton, tRPC init, CI base | ✅ **COMPLETATA** |
| **1** | Data Layer | Shakespeare | 0 | Migrations, seed genres, entities TypeORM, `db:migrate` verde | ✅ **COMPLETATA** |
| **2** | Auth | McCarthy + Ishiguro | 1 | Login page, CredentialsProvider, middleware protezione rotte | ✅ **COMPLETATA** |
| **3** | Core Backend | McCarthy | 2 | tRPC CRUD: book / author / genre / tag — testabili via Postman/client | ✅ **COMPLETATA** |
| **4** | CSV Import | McCarthy | 3 | `tsx scripts/import-csv.ts` — libreria di Luciano nel DB | ✅ **COMPLETATA** |
| **5** | Frontend Core | Ishiguro | 3 | Lista libri, form aggiunta/modifica, dettaglio — **app usabile end-to-end** ⭐ | ✅ **COMPLETATA** |
| **6** | Search & Filters | Ishiguro | 5 | pg_trgm search (già nel backend), chip rimovibili, filtri tag/anno/stato, URL params, contatore TBR/Letti | ✅ **COMPLETATA** |
| **7** | Cover Integration | McCarthy + Ishiguro | 5 | `title_en` field, Google Books service (waterfall en→it→null), campo form, display dettaglio | 🔨 **IN CORSO** |
| **8** | Polish | Ishiguro | 6+7 | Tag Manager, dark mode, skeleton loading, export CSV/JSON | ⏳ |

**Primo deliverable usabile (thin vertical slice):** fine Fase 5

---

## Rischi Tecnici

### 🔴 Critici (azione immediata)

| ID | Rischio | Mitigazione |
|---|---|---|
| R11 | `NEXTAUTH_SECRET` in repo | Pre-commit hook per secret detection in Fase 0 |
| R14 | Credenziali hardcoded nel codice | Solo env vars, mai nel codice. `.env.example` con tutti i placeholder |

### 🟡 Medi

| ID | Rischio | Mitigazione |
|---|---|---|
| R06 | Coverage libri italiani Google Books incompleta | Placeholder cover + pulsante ricarica manuale |
| R07 | Cambio struttura Google Books API | Wrapper isolato testabile con mock |
| R08 | Rate limit import 500 libri | Delay 200ms tra richieste + flag `--no-covers` |
| R13 | Brute-force su `/api/auth/signin` | `next-rate-limit` in middleware |
| R15 | DataSource TypeORM duplicato in dev (hot reload) | Singleton `global.__dataSource` |

### 🟢 Bassi

| ID | Rischio | Mitigazione |
|---|---|---|
| R04 | Dati CSV sporchi non gestiti | Zod schema CSV definito prima dello script; report errori per riga |
| R19 | Import bloccato se Google Books API down | Flag `--no-covers` rende import indipendente |

---

## Note tecniche — Fase 3

**Fix applicati da McCarthy durante l'implementazione:**

- **Circular dep Turbopack** (`book.entity.ts` ↔ `book-author.entity.ts`): risolto con `import type` + decorator string-based
- **`ctx.session.user` type narrowing** in `protectedProcedure`: aggiunto tipo `AuthenticatedSession` in `init.ts`
- **Migration glob dinamico** incompatibile con Turbopack: migration importate staticamente in `AppDataSource` CLI, non nel runtime `getDataSource()`

**File aggiunti:**
- `src/server/trpc/schemas/` → `book.schema.ts`, `author.schema.ts`, `tag.schema.ts`
- `src/server/trpc/dto/book.dto.ts`
- `src/server/trpc/routers/` → `book.router.ts`, `author.router.ts`, `genre.router.ts`, `tag.router.ts`

**Endpoint verificati:**
- `GET /api/trpc/health.ping` → `"pong"` ✅
- `GET /api/trpc/genre.list` → 18 generi ✅
- `npx tsc --noEmit` → zero errori ✅

---

## Azioni Prioritarie — Prima della Fase 0

1. ✅ Pre-commit hook per secret detection
2. ✅ `.env.example` con tutti i placeholder
3. ✅ POC TypeORM + Next.js 14 App Router (`getDataSource()` pattern)
4. ✅ Zod schema CSV definito prima di scrivere lo script import

---

## Struttura Progetto Next.js

```
src/
├── app/
│   ├── layout.tsx                    # ThemeProvider MUI + tRPC Provider
│   ├── page.tsx                      # → redirect /books
│   ├── books/
│   │   ├── page.tsx                  # Server Component (SSR iniziale)
│   │   └── [id]/page.tsx
│   └── api/trpc/[trpc]/route.ts
├── server/                           # SERVER-ONLY (import 'server-only')
│   ├── db/
│   │   ├── data-source.ts            # TypeORM DataSource singleton
│   │   ├── entities/                 # Book, Author, Genre, Tag, BookAuthor
│   │   └── migrations/
│   │       ├── 001_InitialSchema.ts
│   │       └── 002_SeedGenres.ts
│   └── trpc/
│       ├── routers/book.router.ts
│       ├── routers/author.router.ts
│       ├── routers/tag.router.ts
│       └── root.ts
├── lib/trpc/                         # Client provider
├── components/books/                 # BookCard, BookList, BookForm, BookSearch
├── scripts/
│   ├── import-csv.ts                 # Import one-shot
│   └── seed-user.ts                  # Crea utente admin da env vars
└── middleware.ts                     # next-auth protezione rotte
```
