# ADR-003: Autenticazione — next-auth v5 con Credentials Provider e sessioni JWT

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** Gibson (Architect), McCarthy (Backend), Woolf (Security)

---

## Context

L'app è ad **uso personale mono-utente**. Tuttavia, se deployata su un server esposto
(VPS, Vercel, ecc.) deve essere protetta da accesso pubblico.

### Opzioni valutate

| Opzione | Pro | Contro |
|---|---|---|
| No auth | Zero effort | App pubblica, chiunque può modificare la libreria |
| HTTP Basic Auth (middleware Vercel/nginx) | Semplicissimo | UX pessima, nessuna sessione, nessun logout |
| next-auth OAuth (Google/GitHub) | UX moderna, zero password da gestire | Richiede OAuth app registrata, overkill per 1 utente |
| **next-auth Credentials** (scelta) | Pieno controllo, email+password, no deps esterne | Credentials provider sconsigliato per multi-user (irrilevante qui) |

---

## Decision

**next-auth v5 (Auth.js)** con `CredentialsProvider`. Strategia sessione: **JWT**
(nessuna tabella `sessions` nel DB — il token vive nel cookie firmato).

---

## Implementation Details

### Stack

```
next-auth@^5 (Auth.js)
bcryptjs             // hashing password (puro JS, no native binding)
```

### Configurazione

```typescript
// src/auth.ts (pattern Auth.js v5)
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@/server/db/data-source';
import { UserEntity } from '@/server/db/entities/user.entity';

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.findOne(UserEntity, {
          where: { email: credentials.email as string },
        });
        if (!user) return null;
        const valid = await compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 giorni
  pages: { signIn: '/login' },
});
```

### Middleware di protezione rotte

```typescript
// src/middleware.ts
import { auth } from '@/auth';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth')
                   || req.nextUrl.pathname === '/login';
  if (!isLoggedIn && !isAuthRoute) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Tabella `users` (minima)

```sql
CREATE TABLE users (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT    UNIQUE NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Seed utente

```typescript
// scripts/seed-user.ts
import { hash } from 'bcryptjs';
// Legge SEED_EMAIL e SEED_PASSWORD da env
const passwordHash = await hash(process.env.SEED_PASSWORD!, 12);
await db.insert(UserEntity, { email: process.env.SEED_EMAIL!, passwordHash });
```

Non esiste registrazione UI. L'unico utente viene creato via script o
variabili d'ambiente in fase di deploy.

### Variabili d'ambiente richieste

```env
NEXTAUTH_SECRET=<stringa casuale min 32 chars>   # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000               # URL app in produzione
SEED_EMAIL=luciano@example.com
SEED_PASSWORD=<password-forte>
```

### tRPC context — propagazione sessione

```typescript
// server/trpc/context.ts
import { auth } from '@/auth';

export async function createContext() {
  const session = await auth();
  return { session };
}

// Middleware tRPC per route protette
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, session: ctx.session } });
});
```

---

## Consequences

### Positive
- Nessun OAuth app da configurare.
- JWT = stateless, nessun round-trip al DB per ogni richiesta autenticata.
- next-auth gestisce: CSRF, rotazione token, cookie sicuri (HttpOnly, SameSite).
- Facilmente estendibile a OAuth (Google, GitHub) in futuro aggiungendo un provider.

### Negative
- `CredentialsProvider` sconsigliato da next-auth per app multi-utente
  (irrilevante: app mono-utente).
- JWT non invalidabile senza ruotare `NEXTAUTH_SECRET` (accettato per uso personale).
- Gestione password manuale: nessun "forgot password" flow
  (accettato: utente singolo, password nota).

---

## Security notes (Woolf review)

- bcrypt cost factor `12` — buon bilanciamento sicurezza/performance (≈300ms su hardware moderno).
- `NEXTAUTH_SECRET` MAI in source code. Obbligatoriamente in `.env.local` e secrets del CI.
- Cookie `__Secure-next-auth.session-token` → HttpOnly, Secure, SameSite=Lax (default next-auth v5).
- Nessun endpoint di registrazione pubblico → nessuna superficie di attacco per account takeover.
