import { expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqliteStorage } from '../../src/local/sqlite';
import { BriefStore } from '../../src/worker/store';

it('initializes, writes and deletes records immediately and persists across reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'brief-storage-'));
  let db = new DatabaseSync(join(directory, 'brief.sqlite'));
  try {
    const store = new BriefStore(sqliteStorage(db));
    expect(store.getSettings().timeZone).toBe('Asia/Kolkata');
    store.write('persisted', { value: 42 });
    store.write('removed', true);
    store.remove('removed');
    db.close();
    db = new DatabaseSync(join(directory, 'brief.sqlite'));
    const reopened = new BriefStore(sqliteStorage(db));
    expect(reopened.read('persisted')).toEqual({ value: 42 });
    expect(reopened.read('removed')).toBeNull();
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
