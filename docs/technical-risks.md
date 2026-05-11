# Scripta Manent — Rischi Tecnici Aggiornati

**Versione:** 1.1 (aggiornato post-decisioni Luciano)  
**Data:** 2026-05-11  
**Autore:** Gibson (Software Architect)

---

## Rischi confermati dal brainstorming (invariati)

| ID | Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|---|
| R01 | N+1 queries TypeORM | Media | Alto | `relations` sempre esplicite, mai lazy loading |
| R02 | Connection pool esaurito in dev | Media | Medio | DataSource singleton con `global.__dataSource` pattern |
| R03 | Entity serialization a client | Alta | Medio | DTO mapping obbligatorio in ogni query tRPC |
| R04 | Dati sporchi CSV import | Alta | Alto | Validazione Zod + report errori riga per riga |
| R05 | Tag inconsistenti (case, spazi) | Alta | Basso | Normalizzazione automatica: `trim()` + `toLowerCase()` |

---

## Nuovi rischi — Google Books API (ADR-002)

| ID | Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|---|
| R06 | Coverage incompleta libri italiani | Alta | Basso | Placeholder degno + pulsante "ricarica cover" manuale |
| R07 | Google Books cambia struttura risposta API | Bassa | Medio | Wrapper isolato `fetchGoogleBooksCover()` + test con mock — fix in un posto solo |
| R08 | Rate limiting durante import CSV (~500 req) | Media | Medio | Delay 200ms tra richieste. Flag `--no-covers` per import senza fetch |
| R09 | URL cover rotte nel tempo (link Google) | Media | Basso | Cover già salvata in DB — non ri-fetchata. Impatto solo visivo, non funzionale |
| R10 | Timeout fetch in produzione | Bassa | Basso | `AbortSignal.timeout(5000)` nel fetch + fallback `''` |

---

## Nuovi rischi — next-auth Credentials (ADR-003)

| ID | Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|---|
| R11 | `NEXTAUTH_SECRET` committato in repo | Bassa | Critico | `.gitignore` su `.env.local`. CI/CD usa secrets manager. Pre-commit hook per secret scan |
| R12 | JWT non invalidabile (furto token) | Bassa | Alto | Sessione 30gg. Se compromessa: ruotare `NEXTAUTH_SECRET` invalida tutti i JWT |
| R13 | Brute-force login endpoint | Bassa | Medio | next-auth non ha rate limiting built-in. Mitigazione: middleware `src/middleware.ts` con `next-rate-limit` o deploy dietro CDN con WAF (Cloudflare) |
| R14 | Credenziali hardcoded in codice | Bassa | Critico | Solo env vars (`SEED_EMAIL`, `SEED_PASSWORD`). Script seed non contiene valori reali |

---

## Rischi di architettura aggiornati

| ID | Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|---|
| R15 | TypeORM v0.3 instabile con Next.js 14 App Router | Media | Alto | Usare `AppDataSource.initialize()` in route handler, non in module scope. Pattern: `getDataSource()` lazy singleton |
| R16 | tRPC v11 + next-auth v5: breaking changes recenti | Media | Medio | Fissare versioni in `package.json`. Test di integrazione auth+trpc prima di Fase 3 |
| R17 | MUI v6 + Next.js 14 SSR: flash of unstyled content | Media | Basso | `AppRouterCacheProvider` di MUI v6 + `ThemeRegistry` pattern ufficiale |
| R18 | Genre junction vs text[] — performance degradata | Bassa | Basso | Per 500 libri il JOIN è irrilevante. Indice `idx_book_genres_genre_id` copre il caso d'uso |
| R19 | Import CSV blocca se Google Books API down | Media | Medio | Flag `--no-covers` rende l'import indipendente dall'API esterna |

---

## Matrice rischi (Probabilità × Impatto)

```
         │ Basso  │ Medio  │ Alto   │ Critico
─────────┼────────┼────────┼────────┼─────────
Alta     │ R05    │ R04    │ R01    │
         │ R06    │ R08    │        │
         │        │ R03    │        │
─────────┼────────┼────────┼────────┼─────────
Media    │ R09    │ R02    │ R15    │
         │ R10    │ R13    │        │
         │ R17    │ R16    │        │
         │ R18    │ R19    │        │
─────────┼────────┼────────┼────────┼─────────
Bassa    │        │ R07    │ R12    │ R11
         │        │        │        │ R14
```

**Priorità di mitigazione immediata (prima di Fase 0):**
1. **R11** — pre-commit hook + `.gitignore` configurato da Pasolini
2. **R14** — template `.env.example` senza valori reali
3. **R04** — Zod schema CSV definito prima di scrivere lo script import
4. **R15** — POC TypeORM + Next.js 14 App Router prima di Fase 1
