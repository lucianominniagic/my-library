import { type DataSource } from 'typeorm';

export interface Context {
  db?: DataSource;
}

export async function createContext(): Promise<Context> {
  // DataSource viene iniettato lazily nelle procedure che ne hanno bisogno
  // per evitare connessioni inutili nelle route pubbliche
  return {};
}
