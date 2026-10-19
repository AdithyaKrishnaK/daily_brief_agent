import type { DatabaseSync } from 'node:sqlite';
import type { SqlStorage } from '../worker/store';

export function sqliteStorage(db: DatabaseSync): SqlStorage {
  return { sql: { exec(query, ...args) {
    const statement = db.prepare(query);
    const rows = statement.columns().length ? statement.all(...args) : (statement.run(...args), []);
    return { toArray: () => rows };
  } } };
}
