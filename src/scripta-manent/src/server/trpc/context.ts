import { auth } from '@/auth';
import { getDataSource } from '@/server/db/data-source';
import { type DataSource } from 'typeorm';
import { type Session } from 'next-auth';

export interface Context {
  db: DataSource;
  session: Session | null;
}

export async function createContext(): Promise<Context> {
  const [ds, session] = await Promise.all([
    getDataSource(),
    auth(),
  ]);
  return { db: ds, session };
}
