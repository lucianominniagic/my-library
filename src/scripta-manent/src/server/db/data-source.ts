import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';

// Carica .env.local per la TypeORM CLI (Next.js lo carica autonomamente a runtime)
dotenv.config({ path: '.env.local', override: false });
import { UserEntity } from './entities/user.entity';
import { AccountEntity } from './entities/account.entity';
import { SessionEntity } from './entities/session.entity';
import { VerificationTokenEntity } from './entities/verification-token.entity';
import { AuthorEntity } from './entities/author.entity';
import { GenreEntity } from './entities/genre.entity';
import { TagEntity } from './entities/tag.entity';
import { BookAuthorEntity } from './entities/book-author.entity';
import { BookEntity } from './entities/book.entity';

// Migrazioni importate esplicitamente — evita il glob `*.ts` che Turbopack
// non riesce a risolvere staticamente (expression too dynamic).
import { InitialSchema1710000000001 } from './migrations/001_InitialSchema';
import { SeedGenres1710000000002 } from './migrations/002_SeedGenres';
import { AddPasswordHash1710000000003 } from './migrations/003_AddPasswordHash';

const entities = [
  UserEntity,
  AccountEntity,
  SessionEntity,
  VerificationTokenEntity,
  AuthorEntity,
  GenreEntity,
  TagEntity,
  BookAuthorEntity,
  BookEntity,
];

const migrations = [InitialSchema1710000000001, SeedGenres1710000000002, AddPasswordHash1710000000003];

const baseOptions: DataSourceOptions = {
  type:        'postgres',
  url:         process.env.DATABASE_URL,
  synchronize: false, // MAI true — usare solo migrations
  logging:     process.env.NODE_ENV === 'development',
  entities,
};

/**
 * Singleton DataSource exported for the TypeORM CLI.
 * Include le migrations — utilizzata solo da `npm run typeorm`.
 */
export const AppDataSource = new DataSource({ ...baseOptions, migrations });

declare global {
  // eslint-disable-next-line no-var
  var __dataSource: DataSource | undefined;
}

/**
 * DataSource per il runtime Next.js.
 * NON include le migrations: le migration vengono eseguite solo dalla CLI.
 */
export async function getDataSource(): Promise<DataSource> {
  if (global.__dataSource?.isInitialized) return global.__dataSource;
  const ds = new DataSource(baseOptions);
  await ds.initialize();
  if (process.env.NODE_ENV !== 'production') global.__dataSource = ds;
  return ds;
}

