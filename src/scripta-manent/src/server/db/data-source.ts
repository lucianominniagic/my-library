import 'reflect-metadata';
import 'server-only';
import { DataSource } from 'typeorm';

const dataSourceOptions = {
  type: 'postgres' as const,
  url: process.env.DATABASE_URL,
  synchronize: false, // MAI true — usare solo migrations
  logging: process.env.NODE_ENV === 'development',
  entities: ['src/server/db/entities/*.entity.ts'],
  migrations: ['src/server/db/migrations/*.ts'],
};

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
