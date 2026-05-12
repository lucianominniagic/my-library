/**
 * update-title-en.ts — Script one-shot per aggiornare `title_en` dalla mappa CSV.
 *
 * Legge `docs/title_en_map.csv` (separatore `;`, header `titolo_it;title_en`,
 * righe che iniziano con `#` sono commenti e vengono ignorate).
 *
 * Comportamento per libro:
 *   - Non trovato             → [NOT FOUND] + conteggio
 *   - Trovato, `title_en` già valorizzato e --force assente → [SKIP] + conteggio
 *   - Trovato, `title_en` null (o --force attivo)           → [UPDATE] + conteggio
 *
 * Flags CLI:
 *   --dry-run   nessuna scrittura, solo report
 *   --verbose   log dettagliato riga per riga
 *   --force     sovrascrive anche i libri che hanno già title_en valorizzato
 *
 * Usage:
 *   npm run update:title-en            # aggiornamento reale
 *   npm run update:title-en:dry        # dry-run + verbose (nessuna scrittura)
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { ILike } from 'typeorm';

import { AppDataSource } from '../server/db/data-source';
import { BookEntity } from '../server/db/entities/book.entity';

// ─────────────────────────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const FORCE = process.argv.includes('--force');

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────
// __dirname = <project>/src/scripts  →  ../../../../  = <repo root>
const CSV_PATH = path.resolve(__dirname, '../../../../docs/title_en_map.csv');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface CsvRow {
  titolo_it: string;
  title_en: string;
}

interface Stats {
  updated: number;
  skipped: number;
  notFound: number;
  errors: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (DRY_RUN) console.log('🔍 DRY-RUN attivo — nessuna scrittura verrà eseguita\n');
  if (FORCE) console.log('⚠️  FORCE attivo — title_en già valorizzati verranno sovrascritti\n');

  // ── 1. Read & parse CSV ───────────────────────────────────────────────────
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV non trovato: ${CSV_PATH}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM

  // Filter out comment lines (starting with #) before parsing
  const filteredContent = rawContent
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

  // parse() returns string[][]
  const records: string[][] = parse(filteredContent, {
    delimiter: ';',
    skip_empty_lines: true,
    relax_column_count: true,
  });

  // Skip header row, build typed rows
  const csvRows: CsvRow[] = records
    .slice(1)
    .map((record) => ({
      titolo_it: record[0]?.trim() ?? '',
      title_en: record[1]?.trim() ?? '',
    }))
    .filter((r) => r.titolo_it && r.title_en);

  console.log(`📄 Righe CSV caricate: ${csvRows.length}\n`);

  // ── 2. Initialise DB ──────────────────────────────────────────────────────
  await AppDataSource.initialize();

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  const stats: Stats = {
    updated: 0,
    skipped: 0,
    notFound: 0,
    errors: 0,
  };

  try {
    const em = queryRunner.manager;
    const bookRepo = em.getRepository(BookEntity);

    for (let i = 0; i < csvRows.length; i++) {
      const lineNum = i + 2; // 1-based, +1 for header
      const { titolo_it, title_en } = csvRows[i];

      try {
        // ── Find book by case-insensitive title match ──
        const books = await bookRepo.find({
          where: { title: ILike(titolo_it) },
        });

        if (books.length === 0) {
          if (VERBOSE) console.log(`[NOT FOUND] Riga ${lineNum}: "${titolo_it}"`);
          stats.notFound++;
          continue;
        }

        // Update all matching books (app is single-user, but be thorough)
        for (const book of books) {
          if (book.titleEn !== null && !FORCE) {
            if (VERBOSE)
              console.log(
                `[SKIP] Riga ${lineNum}: "${titolo_it}" — title_en già valorizzato ("${book.titleEn}")`,
              );
            stats.skipped++;
            continue;
          }

          if (!DRY_RUN) {
            book.titleEn = title_en;
            await bookRepo.save(book);
          }

          console.log(`[UPDATE] Riga ${lineNum}: "${titolo_it}" → "${title_en}"`);
          stats.updated++;
        }
      } catch (rowErr) {
        console.error(`[ERROR] Riga ${lineNum}: "${titolo_it}" — ${(rowErr as Error).message}`);
        stats.errors++;
        // Non bloccare l'intero aggiornamento per un singolo errore
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
=== Update title_en completato ===
Aggiornati:   ${stats.updated}
Skippati:     ${stats.skipped}
Non trovati:  ${stats.notFound}
Errori:       ${stats.errors}
`);

  if (stats.errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Errore non gestito:', err);
  process.exit(1);
});
