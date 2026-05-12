import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

// Carica .env.local per la TypeORM CLI (Next.js lo carica autonomamente a runtime)
dotenv.config({ path: '.env.local', override: false });

// Importa tutte le entities dal barrel — stesso path usato dai router (@/server/db/entities)
// Questo garantisce che Turbopack/Node.js usi la STESSA istanza delle classi entity
// sia qui che nei router, evitando EntityMetadataNotFoundError.
import {
  UserEntity,
  AccountEntity,
  SessionEntity,
  VerificationTokenEntity,
  AuthorEntity,
  GenreEntity,
  TagEntity,
  BookAuthorEntity,
  BookGenreEntity,
  BookTagEntity,
  BookEntity,
} from '@/server/db/entities';

// Migrazioni importate esplicitamente — evita il glob `*.ts` che Turbopack
// non riesce a risolvere staticamente (expression too dynamic).
import { InitialSchema1710000000001 } from './migrations/001_InitialSchema';
import { SeedGenres1710000000002 } from './migrations/002_SeedGenres';
import { AddPasswordHash1710000000003 } from './migrations/003_AddPasswordHash';
import { AddTitleEn1710000000004 } from './migrations/004_AddTitleEn';

const entities = [
  UserEntity,
  AccountEntity,
  SessionEntity,
  VerificationTokenEntity,
  AuthorEntity,
  GenreEntity,
  TagEntity,
  BookAuthorEntity,
  BookGenreEntity,
  BookTagEntity,
  BookEntity,
];

const migrations = [InitialSchema1710000000001, SeedGenres1710000000002, AddPasswordHash1710000000003, AddTitleEn1710000000004];

/**
 * AppDataSource — singleton module-level.
 * Usato sia dalla CLI TypeORM (con migrations) che dal runtime Next.js.
 * Il pattern module-level garantisce che le entity class references siano
 * le stesse usate dai router, prevenendo EntityMetadataNotFoundError.
 */
export const AppDataSource = new DataSource({
  type:        'postgres',
  host:        process.env.DB_HOST     ?? 'localhost',
  port:        Number(process.env.DB_PORT ?? 5432),
  username:    process.env.DB_USER,
  password:    process.env.DB_PASSWORD,
  database:    process.env.DB_NAME,
  synchronize: false,
  logging:     process.env.NODE_ENV === 'development',
  entities,
  migrations,
});

/**
 * Inizializza la connessione al DB (lazy, idempotente).
 * Usato da createContext() tRPC e da qualsiasi server-side code.
 */
export async function initializeDBConnection(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}

/** @deprecated Usa initializeDBConnection() */
export const getDataSource = initializeDBConnection;

