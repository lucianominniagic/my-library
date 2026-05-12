# Reconstruction Report — `.env.local` — Scripta Manent

> **Generato da**: Pasolini (DevOps Agent)
> **Data**: 2025-07-16
> **Progetto**: `C:\Sviluppo\my-library\src\scripta-manent`
> **Metodo**: ispezione statica del codice sorgente + confronto con `.env.example`

---

## 1. Riepilogo dell'analisi

| Fonte            | File ispezionati                                                        |
|------------------|-------------------------------------------------------------------------|
| `.env.example`   | radice del progetto                                                     |
| Codice sorgente  | `src/server/db/data-source.ts`, `src/auth.ts`, `src/lib/trpc/provider.tsx`, `src/scripts/*.ts` |

---

## 2. Variabili rilevate nel codice

### 2.1 Database — connessione granulare (TypeORM `AppDataSource`)

> **File**: `src/server/db/data-source.ts` (righe 56–60)

| Variabile     | Default | Obbligatoria | Descrizione                                      |
|---------------|---------|:------------:|--------------------------------------------------|
| `DB_HOST`     | `localhost` | No       | Hostname del server PostgreSQL                   |
| `DB_PORT`     | `5432`  | No           | Porta TCP di PostgreSQL                          |
| `DB_USER`     | —       | **Sì**       | Username del DB                                  |
| `DB_PASSWORD` | —       | **Sì**       | Password del DB                                  |
| `DB_NAME`     | —       | **Sì**       | Nome del database                                |

> ⚠️ **ATTENZIONE — Gap critico**: il codice usa le 5 variabili granulari `DB_*`
> ma il `.env.example` documenta solo `DATABASE_URL`.
> **`DATABASE_URL` non viene mai letta dal codice.** (vedere sezione 4)

---

### 2.2 NextAuth — autenticazione

> **File**: `src/auth.ts` — NextAuth legge queste variabili automaticamente dall'ambiente,
> senza chiamate esplicite a `process.env`.

| Variabile        | Obbligatoria | Descrizione                                                   |
|------------------|:------------:|---------------------------------------------------------------|
| `NEXTAUTH_SECRET` | **Sì**      | Chiave segreta per firmare i JWT. Genera con: `openssl rand -base64 32` |
| `NEXTAUTH_URL`   | **Sì** (dev) | URL base dell'app. Richiesto in sviluppo locale e produzione non-Vercel |

---

### 2.3 Admin user — script di seed

> **File**: `src/scripts/seed-user.ts` (righe 10–12), `src/scripts/import-csv.ts` (riga 190)

| Variabile        | Default    | Obbligatoria | Descrizione                                       |
|------------------|------------|:------------:|---------------------------------------------------|
| `ADMIN_EMAIL`    | —          | **Sì**       | Email dell'utente admin (usata da `seed-user.ts` e `import-csv.ts`) |
| `ADMIN_PASSWORD` | —          | **Sì**       | Password in chiaro per il seed — sarà hashata con bcrypt |
| `ADMIN_NAME`     | `'Luciano'`| No           | Nome visualizzato dell'admin                      |

---

### 2.4 Vercel — opzionale / deploy cloud

> **File**: `src/lib/trpc/provider.tsx` (riga 10)

| Variabile    | Obbligatoria | Descrizione                                                         |
|--------------|:------------:|---------------------------------------------------------------------|
| `VERCEL_URL` | No           | Iniettata automaticamente da Vercel in produzione. **Non serve in locale.** |

---

## 3. Variabili nel `.env.example` — stato rispetto al codice

| Variabile nel `.env.example` | Trovata nel codice? | Note                                                                          |
|-----------------------------|:-------------------:|-------------------------------------------------------------------------------|
| `DATABASE_URL`              | ❌ NO               | **Obsoleta / gap di documentazione** — il codice usa `DB_HOST/PORT/USER/PASSWORD/NAME` |
| `NEXTAUTH_URL`              | ✅ sì (implicita)   | Letta automaticamente da NextAuth                                              |
| `NEXTAUTH_SECRET`           | ✅ sì (implicita)   | Letta automaticamente da NextAuth                                              |
| `ADMIN_EMAIL`               | ✅ sì               | `seed-user.ts`, `import-csv.ts`                                               |
| `ADMIN_PASSWORD`            | ✅ sì               | `seed-user.ts`                                                                |
| `ADMIN_NAME`                | ✅ sì               | `seed-user.ts`                                                                |
| `GOOGLE_BOOKS_API_KEY`      | ❌ NO               | **Non usata** — `google-books.service.ts` fa chiamate pubbliche senza API key |

---

## 4. Gap identificati

### Gap A — `DATABASE_URL` vs variabili `DB_*` (critico)

Il `.env.example` documenta:
```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/scripta_manent
```

Ma `src/server/db/data-source.ts` configura TypeORM con:
```ts
host:     process.env.DB_HOST     ?? 'localhost',
port:     Number(process.env.DB_PORT ?? 5432),
username: process.env.DB_USER,
password: process.env.DB_PASSWORD,
database: process.env.DB_NAME,
```

**`DATABASE_URL` non viene mai parsata né usata.** Il `.env.example` va allineato con la realtà del codice, oppure andrebbe aggiunto un parser esplicito. Per ora: usa le 5 variabili `DB_*`.

### Gap B — `GOOGLE_BOOKS_API_KEY` non usata

Il service `google-books.service.ts` chiama l'API pubblica senza autenticazione (`fetch(url)` senza headers). La variabile è documentata nell'example ma il codice non la legge. Potrebbe essere un residuo di una fase pianificata ma non implementata.

---

## 5. Template `.env.local` — pronto da compilare

```dotenv
# ─────────────────────────────────────────────────────────────────────────────
# Scripta Manent — .env.local
# ─────────────────────────────────────────────────────────────────────────────
# ISTRUZIONI: sostituisci tutti i placeholder con i valori reali.
# NON committare mai questo file (è già in .gitignore).
# ─────────────────────────────────────────────────────────────────────────────

# ── Database PostgreSQL (TypeORM AppDataSource) ───────────────────────────────
# Crea il DB con: createdb scripta_manent
# oppure: psql -c "CREATE DATABASE scripta_manent;"
DB_HOST=localhost
DB_PORT=5432
DB_USER=your-postgres-username
DB_PASSWORD=your-postgres-password
DB_NAME=scripta_manent

# ── NextAuth ──────────────────────────────────────────────────────────────────
# Genera NEXTAUTH_SECRET con: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-generate-with-openssl-rand-base64-32

# ── Admin user (usato da seed-user.ts e import-csv.ts) ───────────────────────
ADMIN_EMAIL=luciano@example.com
ADMIN_PASSWORD=your-secure-password
ADMIN_NAME=Luciano

# ── Google Books API (attualmente non usata dal codice) ───────────────────────
# Il service google-books.service.ts fa chiamate pubbliche senza API key.
# Decommentare solo se si aggiunge autenticazione alle chiamate API.
# GOOGLE_BOOKS_API_KEY=your-google-books-api-key

# ── Vercel (solo in produzione, iniettata automaticamente) ───────────────────
# Non serve in locale. Vercel la imposta da sé in deploy.
# VERCEL_URL=your-vercel-deployment-url
```

---

## 6. Checklist per il ripristino

- [ ] Creare `.env.local` nella root di `src/scripta-manent/` usando il template sopra
- [ ] Compilare `DB_USER`, `DB_PASSWORD` con le credenziali PostgreSQL locali
- [ ] Verificare che il database `scripta_manent` esista: `psql -c "\l" | grep scripta`
- [ ] Generare `NEXTAUTH_SECRET`: `openssl rand -base64 32` (oppure PowerShell: `[Convert]::ToBase64String((1..32 | % { Get-Random -Max 256 }))`)
- [ ] Impostare `ADMIN_EMAIL` e `ADMIN_PASSWORD` per lo script di seed
- [ ] Eseguire le migrazioni se necessario: `npm run migration:run`
- [ ] Eseguire il seed admin se necessario: `npm run seed:user`
- [ ] Verificare l'avvio: `npm run dev`

---

## 7. Raccomandazione — allineare `.env.example`

Il `.env.example` attuale è **parzialmente obsoleto** (documenta `DATABASE_URL` e `GOOGLE_BOOKS_API_KEY` non usate dal codice, non documenta `DB_HOST/PORT/USER/PASSWORD/NAME`). Si raccomanda di aggiornarlo per farlo coincidere con il template al punto 5.

```bash
# Comando suggerito (da eseguire dalla root del progetto):
# Aggiorna .env.example con le variabili corrette
```

Aprire un task su Ghosh (Technical Writer) per aggiornare la documentazione contestualmente.
