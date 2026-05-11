import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

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

const dataSourceOptions = {
  type: 'postgres' as const,
  url: process.env.DATABASE_URL,
  synchronize: false, // MAI true — usare solo migrations
  logging: process.env.NODE_ENV === 'development',
  entities: [
    UserEntity,
    AccountEntity,
    SessionEntity,
    VerificationTokenEntity,
    AuthorEntity,
    GenreEntity,
    TagEntity,
    BookAuthorEntity,
    BookEntity,
  ],
  migrations: ['src/server/db/migrations/*.ts'],
};

/**
 * Singleton DataSource exported for the TypeORM CLI.
 * Next.js runtime uses getDataSource() instead (supports hot-reload).
 */
export const AppDataSource = new DataSource(dataSourceOptions);

declare global {
  // eslint-disable-next-line no-var
  var __dataSource: DataSource | undefined;
}

export async function getDataSource(): Promise<DataSource> {
  if (global.__dataSource?.isInitialized) return global.__dataSource;
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  if (process.env.NODE_ENV !== 'production') global.__dataSource = ds;
  return ds;
}
