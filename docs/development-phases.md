# Scripta Manent — Piano di Sviluppo a Fasi

**Versione:** 1.0  
**Data:** 2026-05-11  
**Autore:** Gibson (Software Architect)  
**Input:** Brainstorming 2026-05-11 + Risposte Luciano  
**Destinatario:** Murakami (Orchestrator → backlog di sviluppo)

---

## Principi guida

- **Thin vertical slice first** — prodotto funzionante il prima possibile, poi ampliare.
- Ogni fase termina con un **deliverable verificabile** (può girare in locale).
- Le fasi sono **sequenziali** dove c'è dipendenza, **parallelizzabili** dove indicato.
- Il criterio di "done" include: migration eseguita, tRPC procedure testata, UI base funzionante.

---

## Schema delle fasi

```
Phase 0 ─── Foundation
    │
Phase 1 ─── Data Layer (DB entities + migrations + seed)
    │
Phase 2 ─── Auth (next-auth, login, middleware)
    │
Phase 3 ─── Core Backend (tRPC routers CRUD)
    │
Phase 4 ─── CSV Import (script one-shot + caricamento dati reali)
    │
Phase 5 ─── Frontend Core (thin slice: lista + form + dettaglio)
    │
Phase 6 ─── Search & Filters (pg_trgm + URL params)
    │
Phase 7 ─── Cover Integration (Google Books API)
    │
Phase 8 ─── Frontend Polish (Tag Manager, Rating inline, Skeleton, Export)
```

---

## Fase 0 — Foundation

**Obiettivo:** Repo Next.js 14 App Router funzionante con tutte le dipendenze installate
e ambienti di sviluppo/test configurati.

**Responsabile:** Pasolini (DevOps/Infra)

**Deliverable:**
- `package.json` con dipendenze: `next@14`, `typeorm`, `pg`, `trpc`, `@mui/material`,
  `next-auth@5`, `bcryptjs`, `zod`
- `docker-compose.yml` con servizio PostgreSQL 16 (porta 5432)
- `.env.example` con tutte le variabili richieste documentate
- `src/server/db/data-source.ts` — TypeORM DataSource singleton
- `src/app/api/trpc/[trpc]/route.ts` — handler tRPC
- `src/lib/trpc/` — client tRPC provider
- Script `package.json`: `dev`, `build`, `db:migrate`, `db:seed`
- `README.md` con istruzioni setup locale

**Dipendenze da fasi precedenti:** nessuna

---

## Fase 1 — Data Layer

**Obiettivo:** Schema DB completo, migrations eseguibili, seed generi e utente admin.

**Responsabile:** Shakespeare (DB)

**Deliverable:**
- TypeORM entities: `BookEntity`, `AuthorEntity`, `GenreEntity`, `TagEntity`,
  `BookAuthorEntity`, `BookGenreEntity` (via @ManyToMany), `BookTagEntity`, `UserEntity`
- Migrations TypeORM (in ordine):
  - `001-create-extensions` — `uuid-ossp`, `unaccent`, `pg_trgm`
  - `002-create-users`
  - `003-create-authors`
  - `004-create-books` — con `year_read`, `rating`, `notes`, `cover_url`, `isbn`
  - `005-create-genres-and-junction`
  - `006-create-tags-and-junction`
  - `007-create-book-authors`
  - `008-seed-genres` — insert vocabolario fisso
  - `009-create-search-indexes` — GIN trgm su title, author.name
- Script `scripts/seed-user.ts` — crea l'utente da env vars

**Schema definitivo (post ADR-001, ADR-004):**

```
users
authors ──< book_authors >── books ──< book_genres >── genres
                              │
                              └──< book_tags >── tags
```

**Campi chiave `books`:**
```
id, title, isbn, published_year, cover_url,
year_read (nullable), rating (nullable 1-5), notes,
search_vector, created_at, updated_at
```

**Dipendenze da fasi precedenti:** Fase 0

---

## Fase 2 — Autenticazione

**Obiettivo:** Login funzionante, rotte protette da middleware, sessione JWT.

**Responsabile:** McCarthy (Backend) + Ishiguro (Frontend — solo pagina /login)

**Deliverable:**
- `src/auth.ts` — configurazione next-auth v5 con CredentialsProvider
- `src/middleware.ts` — protezione tutte le rotte eccetto `/login` e `/api/auth/**`
- `src/app/login/page.tsx` — form email + password (MUI, nessuna registrazione)
- `src/server/trpc/context.ts` — propagazione sessione in tRPC
- `protectedProcedure` middleware tRPC
- Test: login con credenziali corrette → redirect `/`, login errato → errore

**Dipendenze da fasi precedenti:** Fase 1 (tabella users + seed)

---

## Fase 3 — Core Backend (tRPC CRUD)

**Obiettivo:** Tutti i router tRPC per CRUD libri, autori, generi, tag — validati con Zod.

**Responsabile:** McCarthy (Backend)

**Deliverable:**

```
appRouter
├── book
│   ├── list      (paginato: page, limit, con filtri vuoti per ora)
│   ├── byId
│   ├── create    (con Google Books cover fetch — stub per ora, vedi Fase 7)
│   ├── update
│   └── delete
├── author
│   ├── list
│   └── upsert    (create or find by name+aliases)
├── genre
│   └── list      (solo lettura, seeded)
└── tag
    ├── list
    ├── create
    ├── delete
    └── attach    (bookId, tagIds[], mode: 'set' | 'add' | 'remove')
```

- Zod schemas in `src/shared/schemas/` (riusabili client+server)
- DTO mapping obbligatorio (nessuna entity serializzata direttamente)
- Nessun lazy loading TypeORM: tutte le relations caricate con `relations:[]` esplicite

**Dipendenze da fasi precedenti:** Fase 2

---

## Fase 4 — Import CSV

**Obiettivo:** Dati reali caricati nel DB. Punto di verifica critico: schema + import = libreria di Luciano.

**Responsabile:** McCarthy (Backend)

**Deliverable:**
- `scripts/import-csv.ts` — script standalone con `tsx`
- Logica:
  1. Legge `docs/Le mie letture.csv`
  2. Parsa e valida ogni riga con Zod
  3. Upsert `Author` (by name, crea aliases per typo)
  4. Lookup `Genre` by name → mapping → `genre_id`
  5. Insert `Book` con `year_read`, `rating`, `notes` inline (ADR-001)
  6. Crea `book_genres`, `book_authors`
  7. Fetch cover Google Books con delay 200ms (ADR-002) — può essere disabilitato con flag
  8. Report finale: N successi, M errori con dettaglio riga

- `scripts/import-csv.ts --no-covers` → import veloce senza fetch cover
- Il script è idempotente se rieseguito (upsert by isbn o title+author)

**Dipendenze da fasi precedenti:** Fase 3

---

## Fase 5 — Frontend Core (thin vertical slice)

**Obiettivo:** Libreria visibile e navigabile. CRUD libro funzionante end-to-end.

**Responsabile:** Ishiguro (Frontend)

**Deliverable:**

### Pagina `/` — Libreria
- Lista/griglia libri con MUI `Grid2`
- `BookCard` con: copertina (o placeholder), titolo, autore, anno, rating stars
- Paginazione (offset/limit, `TablePagination` MUI)
- FAB "+ Aggiungi libro"
- Skeleton loading (mai blank screen)

### Pagina `/books/[id]` — Dettaglio
- Tutti i campi libro
- Generi come `Chip` readonly
- Tag come `Chip` removibili
- Pulsante Modifica → apre `BookFormDialog`
- Pulsante Elimina (con dialog di conferma)

### `BookFormDialog` — Create/Edit
- Campi: titolo, ISBN, autore(i), generi (multi-select dropdown dal DB), anno lettura,
  rating (stelle cliccabili), note
- Validazione Zod client-side prima di submit
- Cover preview live (mostrata se `cover_url` valorizzato)

**Dipendenze da fasi precedenti:** Fase 3, Fase 4 (dati reali per testing realistico)

---

## Fase 6 — Ricerca & Filtri

**Obiettivo:** Ricerca full-text typo-tolerant e filtri bookmarkabili nell'URL.

**Responsabile:** McCarthy (Backend) + Ishiguro (Frontend)

**Deliverable:**

### Backend (McCarthy)
- `book.search` tRPC procedure:
  ```sql
  WHERE similarity(unaccent(b.title), unaccent($query)) > 0.2
     OR similarity(unaccent(a.name), unaccent($query)) > 0.2
  ORDER BY similarity(...) DESC
  ```
- Aggiornamento `book.list` con filtri combinati:
  `genreSlug`, `tagSlug`, `yearRead` (null|number), `minRating`, `q` (search)

### Frontend (Ishiguro)
- `SearchBar` con debounce 300ms
- `FilterDrawer` laterale con:
  - Chips generi (multi-select)
  - Slider rating minimo
  - Toggle TBR / Letti / Tutti
  - Filtro per anno
- **Filtri attivi** come Chips rimovibili sotto la SearchBar
- Sync filtri ↔ URL params (`useSearchParams`, `router.replace`)
- URL bookmarkable: `/?q=fondazione&genre=fantascienza&minRating=4`

**Dipendenze da fasi precedenti:** Fase 5

---

## Fase 7 — Copertine Google Books

**Obiettivo:** Cover automatiche per tutti i libri.

**Responsabile:** McCarthy (Backend) + Ishiguro (Frontend)

**Deliverable:**

### Backend (McCarthy)
- `fetchGoogleBooksCover(isbn?, title?, authors?)` utility in `src/server/lib/google-books.ts`
- Integrazione in `book.create` e `book.update` (solo se cover vuota)
- `book.refreshCover` mutation (trigger manuale)
- Gestione errori: mai bloccante, fallback `''`
- Test unitario con mock fetch

### Frontend (Ishiguro)
- `BookCover` component con `next/image` + fallback placeholder SVG
- Pulsante "🔄 Ricarica copertina" in `BookFormDialog`
- Placeholder degno (icona libro + colore basato su titolo hash)

**Dipendenze da fasi precedenti:** Fase 5 (form già esistente, si aggiunge pulsante)

---

## Fase 8 — Polish & Features secondarie

**Obiettivo:** Prodotto rifinito e completo secondo tutte le feature volute da Luciano.

**Responsabile:** Ishiguro (Frontend) + McCarthy (Backend per export)

**Deliverable:**

### Tag Manager (`/tags`)
- Lista tag con conteggio libri associati
- Rename tag inline
- Eliminazione tag con conferma (Dialog, non Snackbar — niente undo come da requisiti)
- Click su tag → `/` filtrato per quel tag

### Rating inline in lista
- Stelle cliccabili direttamente nella `BookCard` (aggiorna via `book.update`)

### Export CSV/JSON (`/settings`)
- `book.exportCsv` → download file lato server
- `book.exportJson` → download file lato server
- Sezione "Importazione" con istruzioni script (no UI re-import)

### Pagina `/settings`
- Info: numero libri, numero autori, generi presenti
- Link download export
- Istruzioni import CSV

### Responsive & dark mode
- Palette colori definitiva (seppia/cuoio/avorio)
- Dark mode toggle → `localStorage` + MUI `ThemeProvider`
- Layout responsive: griglia 1 col mobile, 2 col tablet, 3-4 col desktop

**Dipendenze da fasi precedenti:** Fase 6

---

## Riepilogo responsabilità per fase

| Fase | Titolo | Lead | Support |
|---|---|---|---|
| 0 | Foundation | Pasolini | Gibson |
| 1 | Data Layer | Shakespeare | Gibson |
| 2 | Auth | McCarthy | Ishiguro |
| 3 | Core Backend | McCarthy | Shakespeare |
| 4 | CSV Import | McCarthy | Shakespeare |
| 5 | Frontend Core | Ishiguro | McCarthy |
| 6 | Search & Filters | McCarthy + Ishiguro | Shakespeare |
| 7 | Cover Integration | McCarthy | Ishiguro |
| 8 | Polish | Ishiguro | McCarthy |

---

## Dipendenze tra fasi (grafo)

```
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
                          ↑
                     (dati reali)
```

Le fasi 0→4 sono **backend-first** e devono essere completate in sequenza.
Le fasi 5→8 hanno componenti frontend/backend **parallelizzabili** all'interno della stessa fase.

---

## Milestone di verifica

| Milestone | Al termine di | Verifica |
|---|---|---|
| **M1 — Schema vivo** | Fase 1 | `db:migrate` passa, `psql` mostra tutte le tabelle |
| **M2 — Login funziona** | Fase 2 | Login → redirect home, rotta protetta senza login → /login |
| **M3 — CRUD via API** | Fase 3 | tRPC Playground: create/list/delete libro funzionante |
| **M4 — Dati reali** | Fase 4 | N libri importati, 0 errori di validazione critici |
| **M5 — App usabile** | Fase 5 | Lista libri visibile, form crea libro, dettaglio apre |
| **M6 — Ricerca funziona** | Fase 6 | "fondazione" trova "Fondazione" e typo "fondazzione" |
| **M7 — Cover caricate** | Fase 7 | >80% libri con cover, placeholder per gli altri |
| **M8 — Prodotto finito** | Fase 8 | Tag manager, export, dark mode, responsive mobile |

---

## Stima complessità (giorni sviluppo, escludendo review)

| Fase | Backend | Frontend | Totale |
|---|---|---|---|
| 0 | 1 | — | 1 |
| 1 | 2 | — | 2 |
| 2 | 1 | 0.5 | 1.5 |
| 3 | 3 | — | 3 |
| 4 | 1.5 | — | 1.5 |
| 5 | — | 4 | 4 |
| 6 | 1.5 | 2 | 3.5 |
| 7 | 1 | 1 | 2 |
| 8 | 1 | 3 | 4 |
| **Totale** | **12** | **10.5** | **22.5** |
