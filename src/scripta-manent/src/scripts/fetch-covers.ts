/**
 * fetch-covers.ts — Script batch per recuperare la cover URL dei libri senza cover.
 *
 * Per ogni libro con `cover_url` null o vuota chiama `fetchCoverUrl()` dal
 * google-books service e, se trovata, aggiorna il record nel DB.
 *
 * Flags CLI:
 *   --dry-run    nessuna scrittura nel DB, solo simulazione e log
 *   --verbose    log dettagliato per ogni libro (inclusi i NOT FOUND)
 *   --limit N    processa al massimo N libri (es. --limit 50 per test parziale)
 *
 * Usage:
 *   npm run fetch:covers             # aggiornamento reale
 *   npm run fetch:covers:dry         # dry-run + verbose (nessuna scrittura)
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { IsNull } from 'typeorm';

import { AppDataSource } from '../server/db/data-source';
import { BookEntity } from '../server/db/entities/book.entity';
import { fetchCoverUrl } from '../server/trpc/services/google-books.service';

// ─────────────────────────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Stats {
  processed: number;
  found: number;
  notFound: number;
  errors: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (DRY_RUN) console.log('🔍 DRY-RUN attivo — nessuna scrittura verrà eseguita\n');
  if (limit !== Infinity) console.log(`⚙️  Limite attivo — verranno processati al massimo ${limit} libri\n`);

  // ── 1. Initialise DB ───────────────────────────────────────────────────────
  await AppDataSource.initialize();

  const stats: Stats = {
    processed: 0,
    found: 0,
    notFound: 0,
    errors: 0,
  };

  try {
    const bookRepo = AppDataSource.getRepository(BookEntity);

    // ── 2. Fetch books without cover ────────────────────────────────────────
    const allBooks = await bookRepo.find({
      where: [
        { coverUrl: IsNull() },
        { coverUrl: '' },
      ],
      relations: { bookAuthors: { author: true } },
      order: { createdAt: 'ASC' },
    });

    // Apply --limit
    const books = allBooks.slice(0, limit === Infinity ? undefined : limit);

    console.log(`📚 Libri senza cover trovati: ${allBooks.length}${limit !== Infinity ? ` (processati: ${books.length})` : ''}\n`);

    // ── 3. Process each book ────────────────────────────────────────────────
    for (const book of books) {
      stats.processed++;

      // Determine primary author (lowest sortOrder)
      const authorName =
        book.bookAuthors
          .sort((a, b) => a.sortOrder - b.sortOrder)[0]
          ?.author?.name ?? '';

      try {
        const coverUrl = await fetchCoverUrl({
          titleEn: book.titleEn,
          titleIt: book.title,
          authorName,
        });

        if (coverUrl) {
          if (!DRY_RUN) {
            book.coverUrl = coverUrl;
            await bookRepo.save(book);
          }
          console.log(`[FOUND] "${book.title}" (${authorName}) → ${coverUrl}`);
          stats.found++;
        } else {
          if (VERBOSE) {
            console.log(`[NOT FOUND] "${book.title}" (${authorName})`);
          }
          stats.notFound++;
        }
      } catch (err) {
        console.error(`[ERROR] "${book.title}" (${authorName}) — ${(err as Error).message}`);
        stats.errors++;
        // Non bloccare il run per un singolo errore
      }

      // Delay tra richieste per rispettare i rate limit di Google Books
      await new Promise((r) => setTimeout(r, 200));
    }

    if (DRY_RUN) {
      console.log('\n🔍 Dry-run: nessuna scrittura effettuata');
    } else {
      console.log('\n✅ Aggiornamenti completati');
    }
  } finally {
    await AppDataSource.destroy();
  }

  // ── Final stats ─────────────────────────────────────────────────────────
  console.log(`
=== Fetch covers completato ===
Libri processati: ${stats.processed}
Cover trovate:    ${stats.found}
Non trovate:      ${stats.notFound}
Errori:           ${stats.errors}
`);

  if (stats.errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Errore non gestito:', err);
  process.exit(1);
});
