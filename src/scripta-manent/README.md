# Scripta Manent 📚

Web app personale per catalogare libri. Single-user, uso personale.

## Stack tecnico

- **Framework:** Next.js 14+ (App Router)
- **Database:** PostgreSQL locale
- **ORM:** TypeORM (con decoratori TypeScript)
- **API layer:** tRPC v11
- **UI:** Material UI (MUI) v9
- **Auth:** next-auth v5 (configurata in Fase 2)
- **Runtime:** Node.js 20+, npm

---

## 1. Setup Database PostgreSQL locale

Assicurati che PostgreSQL sia installato e in esecuzione sulla macchina.

**Opzione A — con `createdb`:**
```bash
createdb scripta_manent
```

**Opzione B — con `psql`:**
```bash
psql -U postgres -c "CREATE DATABASE scripta_manent;"
```

**Opzione C — da psql interattivo:**
```sql
psql -U postgres
CREATE DATABASE scripta_manent;
\q
```

> **Nota:** Il progetto usa PostgreSQL locale senza Docker. Assicurati che il servizio PostgreSQL sia avviato (`pg_ctl start` o tramite Services di Windows).

---

## 2. Variabili d'ambiente

Copia il file di esempio e compila con i tuoi valori:

```bash
copy .env.example .env.local
```

Poi modifica `.env.local`:

```env
# Sostituisci USER e PASSWORD con le tue credenziali PostgreSQL
DATABASE_URL=postgresql://postgres:latuapassword@localhost:5432/scripta_manent

# Genera un secret sicuro con:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_SECRET=il-tuo-secret-generato

NEXTAUTH_URL=http://localhost:3000
```

> ⚠️ `.env.local` è in `.gitignore` — non verrà mai committato. Non modificare `.env.example` con credenziali reali.

---

## 3. Installazione dipendenze

```bash
npm install
```

---

## 4. Avvio sviluppo

```bash
npm run dev
```

L'app sarà disponibile su [http://localhost:3000](http://localhost:3000).

**Verifica tRPC health check:**
```
GET http://localhost:3000/api/trpc/health.ping
```
Risposta attesa: `{"result":{"data":"pong"}}`

---

## 5. Migrations database

```bash
# Esegui le migrations pendenti
npm run db:migrate

# Revoca l'ultima migration
npm run db:migrate:revert

# Genera una nuova migration (dal diff delle entity)
npm run db:migration:generate src/server/db/migrations/NomeMigration
```

---

## 6. Struttura del progetto

```
src/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout (TRPCProvider)
│   ├── page.tsx              # Redirect → /books
│   ├── books/                # Lista e dettaglio libri
│   ├── tags/                 # Gestione tag
│   ├── settings/             # Impostazioni
│   ├── login/                # Autenticazione
│   └── api/trpc/[trpc]/      # tRPC fetch handler
│
├── server/
│   ├── db/
│   │   ├── data-source.ts    # TypeORM DataSource singleton (anti-hot-reload)
│   │   ├── entities/         # Entity TypeORM (*.entity.ts)
│   │   └── migrations/       # Migration TypeORM
│   └── trpc/
│       ├── init.ts           # initTRPC, router, publicProcedure
│       ├── context.ts        # createContext
│       ├── routers/          # Router tRPC per dominio
│       └── root.ts           # appRouter = merge di tutti i router
│
├── lib/
│   └── trpc/
│       ├── client.tsx        # createTRPCReact<AppRouter>
│       └── provider.tsx      # TRPCProvider (QueryClient + tRPC)
│
└── components/               # Componenti React riutilizzabili
```

---

## 7. Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia il server di sviluppo |
| `npm run build` | Build di produzione |
| `npm run start` | Avvia il server di produzione |
| `npm run db:migrate` | Esegue le migrations pendenti |
| `npm run db:migrate:revert` | Revoca l'ultima migration |
| `npm run db:migration:generate` | Genera una migration dal diff delle entity |

---

## 8. Pre-commit hooks

Il progetto usa `husky` + `lint-staged`:

- **Secret detection**: blocca il commit se trova credenziali reali (`.env.local`, `NEXTAUTH_SECRET=`, `DATABASE_URL=` con valore reale)
- **ESLint**: controlla i file TypeScript/TSX staged

---

## Fasi di sviluppo

| Fase | Descrizione | Stato |
|------|-------------|-------|
| Fase 0 | Foundation (scaffolding, infra, tRPC) | ✅ Completata |
| Fase 1 | Entity TypeORM + CRUD libri | 🔜 |
| Fase 2 | Autenticazione (next-auth v5) | 🔜 |
| Fase 3 | UI libri con MUI | 🔜 |
| Fase 4 | Tag e categorizzazione | 🔜 |
| Fase 5 | Ricerca e filtri | 🔜 |
| Fase 6 | Statistiche lettura | 🔜 |
| Fase 7 | Google Books API integration | 🔜 |
