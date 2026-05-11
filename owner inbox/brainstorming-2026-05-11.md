# 📚 Scripta Manent — Riepilogo Brainstorming
**Data:** 2026-05-11  
**Partecipanti:** Dick (BA), Gibson (Architect), Shakespeare (DB), Dostojevskij (UX), McCarthy (Backend)

---

## ✅ Decisioni Convergenti (accordo unanime)

| Tema | Decisione | Chi |
|---|---|---|
| **Paginazione** | Offset/limit — cursor-based è overkill per ~500 libri | McCarthy + Gibson |
| **Full-text search** | `pg_trgm` (typo-tolerance, multilingua, no config lingua) — NO ILIKE naive | Shakespeare + Gibson |
| **Genre vs Tag** | Entità **distinte**: Genre = tassonomia semi-fissa, Tag = libero e navigabile | Dick + Shakespeare + Gibson |
| **Author** | Entità separata con `aliases[]` per gestire typo nel CSV ("Alessadro" → alias di "Alessandro") | Shakespeare + Gibson |
| **Import CSV** | Script standalone `tsx scripts/import-csv.ts`, non endpoint API — one-shot | Gibson + McCarthy |
| **tRPC routers** | `book.*`, `tag.*` come macro-aree, Zod schemas condivisi server+client | McCarthy + Gibson |
| **TypeORM** | Mai `synchronize: true`, solo migrations; mai lazy loading, relations sempre esplicite | Gibson |
| **Generi nel DB** | `text[]` con indice GIN — semplice, no join, vocabolario semi-fisso | Shakespeare + McCarthy |
| **`Reading` separata** | Anno lettura + voto su entità `Reading` (supporta reletture future) | Shakespeare |
| **Filtri nell'URL** | `?genre=Fantascienza&tag=mare` — bookmarkable, gratis con App Router | Dick + Dostojevskij |

---

## ⚠️ Domande Aperte — Decisioni che spettano a Luciano

### 1. 📖 Un libro può essere riletto?
Shakespeare ha proposto una tabella `readings` separata (anno + voto per ogni lettura). Gibson e McCarthy hanno `rating` direttamente sul libro. Qual è il caso d'uso? Hai riletto libri che vorresti tracciare separatamente?

### 2. 👤 Un libro può avere più autori?
Con una junction `book_authors` (co-autori, curatele) lo schema lo supporta già. Se non serve, si semplifica con una FK diretta.

### 3. 📚 Libri "da leggere" (wishlist/TBR)?
Il CSV contiene solo libri già letti (hanno `Anno lettura`). Vuoi gestire anche una wishlist, o l'app è solo per libri **già letti**?

### 4. 🖼️ Copertine?
Upload manuale, API esterna (Google Books/OpenLibrary) o niente per ora? Dostojevskij segnala che è un rabbit hole, ma influenza la vista griglia.

### 5. 🔐 Autenticazione?
App esposta pubblicamente o solo in locale/VPN? Per uso personale, `next-auth` con sessione base è sufficiente. Serve decidere prima dell'architettura.

### 6. 🏷️ Generi: vocabolario fisso o libero?
I generi del CSV (es. "Narrativa straniera, Fantascienza") diventano un **set controllato** (dropdown) o anche loro free-form come i tag? Impatto diretto su UI (Chip fissi vs Autocomplete creatable).

### 7. 📊 Import: one-shot o incrementale?
Il CSV è un archivio storico che aggiorni periodicamente? Se sì, serve una strategia di **upsert** per i re-import (basata su titolo+autore).

---

## 💡 Feature di qualità proposte dal team

Unanimemente consigliate anche se non esplicitamente richieste:

- **`Cmd+K` command palette** per ricerca globale rapida
- **Campo Note** libero sul libro (citazioni, impressioni personali)
- **Export CSV/JSON** per non creare lock-in
- **Undo su eliminazione** (Snackbar 5 sec, stile Gmail)
- **Chip filtri attivi** sempre visibili sotto la search bar
- **Stars rating inline** nella lista (non solo in modifica)
- **Skeleton loading** — mai blank screen con lista grande

---

## 🚫 Out of scope v1

Copertine automatiche via API, multi-auth/multi-tenant, Goodreads integration, ML recommendations, i18n, lettura progressiva (% pagine).

---

## Schema DB proposto (Shakespeare)

```
authors ──< book_authors >── books ──< book_tags >── tags
                               │
                               │ genres: text[]
                               │
                               └──< readings
```

### Tabelle principali

| Tabella | Campi chiave |
|---|---|
| `authors` | id, name, nationality, aliases[] |
| `books` | id, title, genres text[], cover_url, search_vector, published_year |
| `book_authors` | book_id, author_id, role (primary/co-author) |
| `readings` | id, book_id, year_read, rating (1-5), notes |
| `tags` | id, name, slug |
| `book_tags` | book_id, tag_id |

### Indici

```sql
CREATE INDEX idx_books_title_trgm   ON books   USING GIN (unaccent(title) gin_trgm_ops);
CREATE INDEX idx_authors_name_trgm  ON authors USING GIN (unaccent(name)  gin_trgm_ops);
CREATE INDEX idx_books_genres       ON books   USING GIN (genres);
CREATE INDEX idx_readings_year      ON readings (year_read);
CREATE INDEX idx_readings_rating    ON readings (rating) WHERE rating IS NOT NULL;
```

---

## Struttura progetto Next.js (Gibson)

```
src/
├── app/                        # Next.js App Router
│   ├── books/page.tsx          # Lista libri (Server Component, SSR iniziale)
│   ├── books/[id]/page.tsx     # Dettaglio libro
│   └── api/trpc/[trpc]/route.ts
├── server/                     # SERVER-ONLY (import 'server-only')
│   ├── db/
│   │   ├── data-source.ts      # TypeORM DataSource singleton
│   │   └── entities/
│   └── trpc/
│       ├── routers/
│       │   ├── book.router.ts
│       │   └── tag.router.ts
│       └── root.ts
├── lib/trpc/                   # Client tRPC provider
├── components/books/           # BookCard, BookList, BookForm, BookSearch
└── scripts/import-csv.ts       # Script standalone import CSV
```

---

## tRPC Router Design (McCarthy)

```
appRouter
├── book
│   ├── list       ← paginato con filtri
│   ├── byId
│   ├── create
│   ├── update
│   ├── delete
│   ├── search     ← full-text + filtri combinati
│   └── importCsv  ← mutation con parse CSV client-side
└── tag
    ├── list
    ├── create
    ├── delete
    └── attach     ← (bookId, tagIds[], mode: set|add|remove)
```

---

## Information Architecture (Dostojevskij)

| # | Schermata | Rotta |
|---|---|---|
| 1 | **Libreria** (home) — lista/griglia con filtri | `/` |
| 2 | **Dettaglio libro** — visualizza, modifica, correlati per tag | `/books/[id]` |
| 3 | **Tag Manager** — CRUD tag, rete libri collegati | `/tags` |
| 4 | **Impostazioni** — import CSV, export, preferenze | `/settings` |

### Componenti MUI chiave
- `DataGrid` (MUI X) per vista tabella con virtualizzazione
- `Autocomplete` + `freeSolo` per tag e generi
- `Rating` per voto stelle
- `Chip` removibili per filtri attivi
- `Drawer` destro per filtri avanzati
- `FAB` "+ Aggiungi libro"
- `DatePicker` con `views={['year']}`

### Palette colori proposta
- Primary: `#3D2B1F` (inchiostro seppia)
- Secondary: `#8B5E3C` (cuoio)
- Background: `#FAF7F2` (carta avorio)
- Dark mode bg: `#1A1208`

---

## Rischi tecnici da monitorare

| Rischio | Mitigazione |
|---|---|
| N+1 queries TypeORM | `relations` sempre esplicite, mai lazy loading |
| Connection pool esaurito in dev | DataSource singleton con `global.__dataSource` |
| Entity serialization a client | DTO mapping obbligatorio in ogni query tRPC |
| Dati sporchi nel CSV import | Validazione Zod + report errori riga per riga |
| Tag inconsistenti (case, spazi) | Normalizzazione automatica: trim + lowercase al salvataggio |
