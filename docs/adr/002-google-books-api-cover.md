# ADR-002: Copertine — Google Books API con cache URL su DB

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** Gibson (Architect), McCarthy (Backend), Dostojevskij (UX)

---

## Context

Le copertine sono critiche per la vista griglia della libreria. Dostojevskij ha identificato
quattro opzioni, avvertendo che è un "rabbit hole". Luciano ha scelto **Google Books API**.

### Opzioni valutate

| Opzione | Pro | Contro |
|---|---|---|
| Manual upload | Pieno controllo | UX friction, storage S3/local, CDN |
| **Google Books API** (scelta) | Gratis, nessuna chiave per uso base, lookup ISBN/titolo | Dipendenza esterna, coverage variabile per libri italiani |
| OpenLibrary | Open Data, no rate limit | Coverage inferiore, qualità immagini bassa |
| Niente per ora | Zero effort | Griglia senza cover = UI degradata |

---

## Decision

Utilizzare **Google Books API** per recuperare la URL della copertina al momento del
salvataggio o della ricerca di un libro. La URL viene salvata nel campo `cover_url` su `books`.

### Fetch strategy (waterfall)

```
1. Cerca per ISBN:        GET /volumes?q=isbn:{isbn}
2. Fallback titolo+autore: GET /volumes?q=intitle:"{title}"+inauthor:"{author}"
3. Se nessun risultato:    cover_url = '' (stringa vuota → UI mostra placeholder)
```

### Endpoint di produzione

```
https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}&maxResults=1
```

### Estrazione URL

```typescript
// Priorità: thumbnail > smallThumbnail
const imageLinks = data.items?.[0]?.volumeInfo?.imageLinks;
const rawUrl = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail ?? '';
// Google Books restituisce http:// → forzare https://
const coverUrl = rawUrl.replace('http://', 'https://');
```

### Quando viene eseguito il fetch

| Trigger | Comportamento |
|---|---|
| `book.create` (tRPC) | Fetch automatico; se fallisce, libro salvato con `cover_url = ''` |
| `book.update` | Fetch solo se ISBN/titolo cambia E `cover_url` è vuoto o utente clicca "Ricarica cover" |
| `scripts/import-csv.ts` | Fetch per ogni libro con delay 200ms tra richieste (rate limit protection) |
| Manuale | UI espone pulsante "Ricarica copertina" → chiama `book.refreshCover` mutation |

### Caching

- **Cache primaria:** `cover_url TEXT` salvato in DB. Una volta valorizzato, non viene
  mai ri-fetchato automaticamente (immutable once set).
- **Nessuna cache Redis/CDN:** per ~500 libri non serve. Le URL Google Books sono stabili.
- **No proxy server:** le richieste a Google Books avvengono **server-side** in un
  tRPC procedure (`'use server'`), mai client-side (evita CORS e leakage di eventuali
  future API key).

---

## Schema

```sql
-- Campo su books:
cover_url  TEXT NOT NULL DEFAULT ''
```

---

## tRPC procedure

```typescript
// server/trpc/routers/book.router.ts
bookRouter.refreshCover = protectedProcedure
  .input(z.object({ bookId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const book = await ctx.db.findOne(BookEntity, { where: { id: input.bookId } });
    const coverUrl = await fetchGoogleBooksCover(book.isbn, book.title, book.authors);
    await ctx.db.update(BookEntity, input.bookId, { coverUrl });
    return { coverUrl };
  });
```

---

## Consequences

### Positive
- Zero costi di storage (solo URL reference).
- Nessun setup CDN o bucket S3.
- Graceful degradation: placeholder se API non risponde.
- Retry manuale disponibile senza rigenerare il record.

### Negative
- **Dipendenza esterna:** se Google Books cambia la struttura della risposta,
  le cover smettono di funzionare. Mitigazione: wrapper `fetchGoogleBooksCover`
  isolato e testabile con mock.
- **Coverage libri italiani:** alcuni titoli non sono indicizzati.
  Mitigazione: fallback titolo+autore + placeholder dignitoso.
- **Rate limiting import CSV:** con ~500 libri e 200ms di delay = ~100 secondi.
  Accettabile per script one-shot.
- **Google non richiede API key per <1000 req/day** (personal app, ok).
  Se in futuro si supera il limite: aggiungere `GOOGLE_BOOKS_API_KEY` env var.

---

## Errori e fallback

```typescript
async function fetchGoogleBooksCover(
  isbn?: string,
  title?: string,
  authors?: string[]
): Promise<string> {
  try {
    // ... fetch logic
  } catch (error) {
    console.warn('[GoogleBooks] Cover fetch failed:', error);
    return ''; // libro salvato senza cover, mai bloccante
  }
}
```
