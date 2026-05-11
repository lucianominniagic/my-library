# 📋 Scripta Manent — Documento di Requisiti (PRD v1.0)

**Data:** 2026-05-11 | **Autore:** Dick (Business Analyst) | **Stato:** APPROVATO

---

## Impatto risposte di Luciano

| # | Risposta | Decisione finale |
|---|---|---|
| 1 | Niente reletture | `year_read` + `rating` + `notes` direttamente su `Book`. Tabella `readings` eliminata. |
| 2 | Co-autori sì | `book_authors (book_id, author_id, role)` confermata |
| 3 | TBR = year_read NULL | `year_read IS NULL` = TBR, `year_read NOT NULL` = Letto. Stessa entità. |
| 4 | Copertine via Google Books | `cover_url TEXT` nullable su Book. Fetch al salvataggio. |
| 5 | next-auth form auth | `CredentialsProvider` + `bcrypt`. Single-user. |
| 6 | Generi vocabolario fisso | Tabella `genres` seeded. Chip fissi. Validazione Zod contro costante. |
| 7 | Import one-shot | Script standalone, insert-only con skip su duplicati. |

---

## User Stories MoSCoW

### 🔴 MUST

#### CRUD Libri
- **REQ-01** Aggiungere libro con titolo, autore/i, genere/i, anno lettura (opt), voto (opt), note (opt)
- **REQ-02** Modificare tutti i campi di un libro
- **REQ-03** Eliminare libro con dialog di conferma (no undo)
- **REQ-04** TBR (year_read NULL) vs Letto (year_read valorizzato) — stesso Book
- **REQ-05** Associare più autori a un libro con ruolo (author/editor/translator)
- **REQ-07** Assegnare voto 1-5 a un libro letto

#### Ricerca e Filtri
- **REQ-10** Ricerca full-text typo-tolerante (pg_trgm) su titolo e autore
- **REQ-11** Filtro per genere (chip da vocabolario fisso, logica OR)
- **REQ-15** Filtri riflessi nell'URL (bookmarkable)
- **REQ-16** Filtri attivi come chip rimovibili sotto la search bar
- **REQ-17** Filtro per stato: TBR / Letti / Tutti

#### Tag System
- **REQ-20** Creare tag liberi con normalizzazione automatica (trim + lowercase)
- **REQ-21** Associare e rimuovere tag da un libro

#### Copertine
- **REQ-30** Suggerimento copertina da Google Books API (ISBN o titolo+autore)
- **REQ-31** Mancanza copertina non blocca il salvataggio

#### Import CSV
- **REQ-40** Import libri da CSV storico via script one-shot
- **REQ-41** Report post-import: OK / scartate / errori per riga

#### Autenticazione
- **REQ-50** Login con email e password (next-auth CredentialsProvider)
- **REQ-51** Tutte le rotte protette da autenticazione
- **REQ-52** Logout dalla sessione

#### Non Funzionale
- **REQ-73** Lista paginata offset/limit

### 🟡 SHOULD
- **REQ-06** Note libere sul libro
- **REQ-12** Filtro per tag (AND)
- **REQ-13** Filtro per anno lettura
- **REQ-22** Tag Manager `/tags` (rinomina/elimina)
- **REQ-23** Navigazione per tag
- **REQ-42** Alias autori per typo CSV
- **REQ-61** Contatore TBR vs Letti in home
- **REQ-70** Skeleton loading
- **REQ-71** Voto stelle inline nella lista

### 🔵 COULD
- **REQ-14** Filtro per voto minimo
- **REQ-60** Dashboard statistiche
- **REQ-72** Export CSV/JSON

### ⚫ WON'T
Multi-tenant, Cmd+K, Undo eliminazione, Import incrementale, OAuth, Goodreads, Reletture, ML, i18n

---

## Acceptance Criteria BDD — 5 Story critiche

### REQ-01 — Aggiunta libro
```gherkin
Scenario: Libro Letto con tutti i campi
  Given l'utente è autenticato
  When compila titolo "Oceano Mare", autore "Baricco", genere "Narrativa italiana", anno_lettura 2019, rating 5
  Then il libro appare in lista con badge "Letto" e 5 stelle

Scenario: Libro TBR senza anno lettura
  When lascia anno_lettura vuoto
  Then il libro appare con badge "Da leggere" e campo rating non visibile

Scenario: Salvataggio senza titolo
  When lascia il campo titolo vuoto
  Then errore "Il titolo è obbligatorio", libro non salvato
```

### REQ-04 — Stato TBR vs Letto
```gherkin
Scenario: Transizione TBR → Letto
  Given libro con year_read = NULL
  When utente inserisce anno_lettura = 2024 e rating = 4
  Then badge cambia a "Letto", campo rating visibile con 4 stelle
  And URL riflette ?status=read
```

### REQ-10 — Ricerca typo-tolerante
```gherkin
Scenario: Typo nel nome autore
  Given esistono libri di "Alessandro Baricco"
  When digita "Barico"
  Then la lista mostra libri di "Alessandro Baricco"

Scenario: Filtri combinati
  Given filtro genere "Fantascienza" attivo
  When digita "Clarke"
  Then solo libri di fantascienza di Clarke
  And URL: ?genre=Fantascienza&q=Clarke
```

### REQ-40 — Import CSV
```gherkin
Scenario: Import completo
  Given CSV con 500 righe valide
  When eseguito "tsx scripts/import-csv.ts"
  Then report "500 importati, 0 errori, 0 saltati"

Scenario: Autore con typo
  Given CSV contiene "Alessadro Baricco"
  And DB ha "Alessandro Baricco" con alias ["Alessadro Baricco"]
  Then libri associati all'autore normalizzato
```

### REQ-50 — Autenticazione
```gherkin
Scenario: Accesso non autenticato
  Given utente non autenticato
  When accede a qualsiasi rotta
  Then redirect a "/login"

Scenario: tRPC senza sessione
  When client chiama mutation senza token
  Then TRPCError UNAUTHORIZED
```

---

## Information Architecture

```
/                   ← Libreria (lista + filtri + search)
/books/[id]         ← Dettaglio libro
/tags               ← Tag Manager
/settings           ← Import CSV, preferenze
/login              ← Login (non autenticati)
```

## tRPC Router Design

```
appRouter
├── book.list / byId / create / update / delete
├── author.list / search / create
├── tag.list / create / rename / delete / attach
└── search.books (pg_trgm, filtri combinati)
```

## Vocabolario Generi

```typescript
export const GENRES = [
  'Autobiografico', 'Avventura', 'Biografico', 'Classici',
  'Classici italiani', 'Divulgazione scientifica', 'Fantascienza',
  'Fantasy', 'Giallo', 'Horror', 'Narrativa italiana',
  'Narrativa straniera', 'Noir', 'Religione', 'Romanzo storico',
  'Saggi', 'Spionaggio',
] as const;
```
