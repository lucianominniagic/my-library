/**
 * import-csv.ts — Script one-shot per importare la libreria di Luciano
 * dal CSV storico nel database PostgreSQL.
 *
 * Idempotente: rieseguibile senza creare duplicati.
 *   - Autori:  dedup per LOWER(name)
 *   - Libri:   dedup per LOWER(title) + user_id
 *
 * Usage:
 *   npm run import:csv             # import reale
 *   npm run import:csv:dry         # dry-run + verbose (nessuna scrittura)
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { ILike } from 'typeorm';

import { AppDataSource } from '../server/db/data-source';
import { UserEntity } from '../server/db/entities/user.entity';
import { AuthorEntity } from '../server/db/entities/author.entity';
import { BookEntity } from '../server/db/entities/book.entity';
import { BookAuthorEntity } from '../server/db/entities/book-author.entity';
import { GenreEntity } from '../server/db/entities/genre.entity';

// ─────────────────────────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────
// __dirname = <project>/src/scripts  →  ../../../../  = <repo root>
const CSV_PATH = path.resolve(__dirname, '../../../../docs/Le mie letture.csv');

// ─────────────────────────────────────────────────────────────────────────────
// Genre normalisation map
// Key: CSV genre (lowercase, trimmed)  →  Value: exact DB name
// ─────────────────────────────────────────────────────────────────────────────
const GENRE_MAP: Record<string, string> = {
  'narrativa italiana': 'Narrativa italiana',
  'narrativa straniera': 'Narrativa straniera',
  'narrativa staniera': 'Narrativa straniera', // typo in CSV
  'classici italiani': 'Classici italiani',
  'classici': 'Classici',
  'fantasy': 'Fantasy',
  'fantascienza': 'Fantascienza',
  'giallo': 'Giallo',
  'thriller': 'Thriller',
  'horror': 'Horror',
  'noir': 'Noir',
  'romanzo storico': 'Romanzo storico',
  'avventura': 'Avventura',
  'spionaggio': 'Spionaggio',
  'saggi': 'Saggi',
  'saggio': 'Saggi',
  'divulgazione scientifica': 'Divulgazione scientifica',
  'divulgazione': 'Divulgazione scientifica',
  'poesia': 'Poesia',
  'teatro': 'Teatro',
  'fumetti': 'Fumetti',
  'autobiografia': 'Autobiografia',
  'autobiografico': 'Autobiografia',
  'biografia': 'Biografia',
  'biografico': 'Biografia',
  'religione': 'Religione',
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface CsvRow {
  title: string;
  authorName: string;
  yearRead: number;
  genreNames: string[];
  rating: number | null;
  nationality: string | null;
}

interface Stats {
  booksInserted: number;
  booksSkipped: number;
  authorsCreated: number;
  authorsFound: number;
  warnings: number;
  errors: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Split a CSV genre cell that may use ", " or ". " as multi-value separator. */
function splitGenres(raw: string): string[] {
  return raw
    .split(/[,\.]\s+/)
    .map((g) => g.trim())
    .filter(Boolean);
}

/** Parse and validate a CSV row (columns 0-5). Returns null if the row is empty/invalid. */
function parseRow(record: string[]): CsvRow | null {
  const title = record[0]?.trim() ?? '';
  const authorName = record[1]?.trim() ?? '';
  const yearRaw = record[2]?.trim() ?? '';
  const genreRaw = record[3]?.trim() ?? '';
  const ratingRaw = record[4]?.trim() ?? '';
  const nationalityRaw = record[5]?.trim() ?? '';

  if (!title || !authorName) return null;

  const yearRead = parseInt(yearRaw, 10);
  if (isNaN(yearRead)) return null;

  const genreNames = genreRaw ? splitGenres(genreRaw) : [];

  const ratingNum = ratingRaw ? parseInt(ratingRaw, 10) : NaN;
  const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : null;

  const nationality = nationalityRaw || null;

  return { title, authorName, yearRead, genreNames, rating, nationality };
}

/** Resolve a CSV genre name to a GenreEntity, using GENRE_MAP + case-insensitive DB lookup. */
function resolveGenre(
  csvGenre: string,
  genresByName: Map<string, GenreEntity>,
  stats: Stats,
  lineNum: number,
): GenreEntity | null {
  const key = csvGenre.toLowerCase().trim();

  // 1. Try GENRE_MAP first
  const mappedName = GENRE_MAP[key];
  if (mappedName) {
    const entity = genresByName.get(mappedName.toLowerCase());
    if (entity) return entity;
    // Mapped name not in DB → warn
    console.warn(`[WARN] Riga ${lineNum}: genere mappato "${mappedName}" non trovato nel DB`);
    stats.warnings++;
    return null;
  }

  // 2. Try direct case-insensitive lookup in the preloaded map
  const direct = genresByName.get(key);
  if (direct) return direct;

  // 3. Not found at all → warn
  console.warn(`[WARN] Riga ${lineNum}: genere CSV "${csvGenre}" non trovato (nessuna mappatura)`);
  stats.warnings++;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (DRY_RUN) console.log('🔍 DRY-RUN attivo — nessuna scrittura verrà eseguita\n');

  // ── 1. Read & parse CSV ───────────────────────────────────────────────────
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV non trovato: ${CSV_PATH}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM

  // parse() returns string[][]
  const records: string[][] = parse(rawContent, {
    delimiter: ';',
    skip_empty_lines: true,
    relax_column_count: true, // ignore trailing ;;;;
  });

  // Skip header row
  const dataRows = records.slice(1);
  console.log(`📄 Righe CSV lette: ${dataRows.length}`);

  // ── 2. Initialise DB ──────────────────────────────────────────────────────
  await AppDataSource.initialize();

  // ── 3. Find admin user ────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('❌ ADMIN_EMAIL non trovato in .env.local');
    await AppDataSource.destroy();
    process.exit(1);
  }

  const userRepo = AppDataSource.getRepository(UserEntity);
  const adminUser = await userRepo.findOne({ where: { email: adminEmail } });
  if (!adminUser) {
    console.error(`❌ Utente admin non trovato nel DB (email: ${adminEmail}). Esegui prima: npm run seed:user`);
    await AppDataSource.destroy();
    process.exit(1);
  }
  console.log(`✅ Admin trovato: ${adminUser.email} (id: ${adminUser.id})\n`);

  // ── 4. Preload all genres from DB ─────────────────────────────────────────
  const genreRepo = AppDataSource.getRepository(GenreEntity);
  const allGenres = await genreRepo.find();
  // Map: lowercase(name) → GenreEntity
  const genresByName = new Map<string, GenreEntity>(
    allGenres.map((g) => [g.name.toLowerCase(), g]),
  );
  console.log(`📚 Generi DB caricati: ${allGenres.length}`);

  // ── 5. Setup transaction ──────────────────────────────────────────────────
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  const stats: Stats = {
    booksInserted: 0,
    booksSkipped: 0,
    authorsCreated: 0,
    authorsFound: 0,
    warnings: 0,
    errors: 0,
  };

  // Author cache: lowercase name → AuthorEntity (within this session)
  const authorCache = new Map<string, AuthorEntity>();

  try {
    const em = queryRunner.manager;

    for (let i = 0; i < dataRows.length; i++) {
      const lineNum = i + 2; // 1-based, +1 for header
      const record = dataRows[i];

      // ── Parse row ──
      const row = parseRow(record);
      if (!row) {
        if (VERBOSE) console.log(`[SKIP] Riga ${lineNum}: vuota o non valida`);
        continue;
      }

      const { title, authorName, yearRead, genreNames, rating, nationality } = row;

      try {
        // ── Find or create Author ──
        const authorKey = authorName.toLowerCase();
        let author = authorCache.get(authorKey);

        if (!author) {
          const existing = await em.getRepository(AuthorEntity).findOne({
            where: { name: ILike(authorName) },
          });

          if (existing) {
            // Update nationality if missing
            if (!existing.nationality && nationality) {
              existing.nationality = nationality;
              if (!DRY_RUN) await em.save(AuthorEntity, existing);
            }
            author = existing;
            authorCache.set(authorKey, author);
            stats.authorsFound++;
            if (VERBOSE) console.log(`  ↳ Autore trovato: "${authorName}"`);
          } else {
            const newAuthor = em.getRepository(AuthorEntity).create({
              name: authorName,
              nationality,
            });
            if (!DRY_RUN) {
              const saved = await em.save(AuthorEntity, newAuthor);
              author = saved;
            } else {
              // In dry-run assign a fake id so subsequent lookups in this run work
              newAuthor.id = `dry-run-${authorKey}`;
              author = newAuthor;
            }
            authorCache.set(authorKey, author);
            stats.authorsCreated++;
            if (VERBOSE) console.log(`  ↳ Autore creato: "${authorName}"`);
          }
        }

        // ── Check book duplicate ──
        const existingBook = await em.getRepository(BookEntity).findOne({
          where: { title: ILike(title), userId: adminUser.id },
        });

        if (existingBook) {
          if (VERBOSE) console.log(`[SKIP] Riga ${lineNum}: "${title}" — già presente`);
          stats.booksSkipped++;
          continue;
        }

        // ── Resolve genres ──
        const genres: GenreEntity[] = genreNames
          .map((csvGenre) => resolveGenre(csvGenre, genresByName, stats, lineNum))
          .filter((g): g is GenreEntity => g !== null);

        // ── Create Book ──
        const book = em.getRepository(BookEntity).create({
          userId: adminUser.id,
          title,
          yearRead,
          rating,
          language: 'it',
          genres,
        });

        if (!DRY_RUN) {
          const savedBook = await em.save(BookEntity, book);

          // ── Create BookAuthor ──
          const ba = em.getRepository(BookAuthorEntity).create({
            bookId: savedBook.id,
            authorId: author.id,
            role: 'author',
            sortOrder: 0,
          });
          await em.save(BookAuthorEntity, ba);
        }

        stats.booksInserted++;
        console.log(`[INSERT] Riga ${lineNum}: "${title}" by ${authorName}`);
      } catch (rowErr) {
        console.error(`[ERROR] Riga ${lineNum}: "${title}" — ${(rowErr as Error).message}`);
        stats.errors++;
        // Non bloccare l'intero import per un singolo errore
      }
    }

    // ── Commit or rollback ──
    if (DRY_RUN) {
      await queryRunner.rollbackTransaction();
      console.log('\n🔍 Dry-run: transazione annullata (nessuna scrittura effettuata)');
    } else {
      await queryRunner.commitTransaction();
      console.log('\n✅ Transazione committata');
    }
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('\n❌ Errore fatale — rollback eseguito:', err);
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }

  // ── Final stats ───────────────────────────────────────────────────────────
  console.log(`
=== Import completato ===
Libri inseriti:  ${stats.booksInserted}
Libri skippati:  ${stats.booksSkipped}
Autori creati:   ${stats.authorsCreated}
Autori trovati:  ${stats.authorsFound}
Warnings:        ${stats.warnings}
Errori:          ${stats.errors}
`);

  if (stats.errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Errore non gestito:', err);
  process.exit(1);
});
