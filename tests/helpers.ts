import { DatabaseSync } from 'node:sqlite';
import { sqliteStorage } from '../src/local/sqlite';
export function database() {
  const db = new DatabaseSync(':memory:');
  return sqliteStorage(db);
}
