import { defaultSettings, SettingsSchema, type Settings, type DashboardState, type InterestProfile, type Article, type Edition, type ActionReceipt,type TaskDraft } from '../shared/contracts';
export interface SqlStorage { sql: { exec(query: string, ...args: any[]): { toArray(): any[] } } }
export const emptyProfile = (): InterestProfile => ({ version: 0, weights: {}, follows: [], suppressions: [], taskStyle: [], evidence: [] });
export class BriefStore {
  constructor(private storage: SqlStorage) { storage.sql.exec('CREATE TABLE IF NOT EXISTS app_records (key TEXT PRIMARY KEY, value TEXT NOT NULL)'); }
  read<T>(key: string): T | null { const row = this.storage.sql.exec('SELECT value FROM app_records WHERE key = ?', key).toArray()[0]; return row ? JSON.parse(row.value) : null; }
  write(key: string, value: unknown) { this.storage.sql.exec('INSERT INTO app_records(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, JSON.stringify(value)); }
  remove(key: string) { this.storage.sql.exec('DELETE FROM app_records WHERE key = ?', key); }
  list<T>(prefix: string): T[] { return this.storage.sql.exec('SELECT value FROM app_records WHERE key LIKE ? ORDER BY key DESC', `${prefix}%`).toArray().map(r => JSON.parse(r.value)); }
  getSettings(): Settings { return this.read<Settings>('settings') ?? structuredClone(defaultSettings); }
  saveSettings(settings: Settings) { this.write('settings', SettingsSchema.parse(settings)); }
  getProfile(): InterestProfile { return this.read<InterestProfile>('profile') ?? emptyProfile(); }
  article(id: string) { return this.read<Article>(`article:${id}`); }
  saveArticle(article: Article) { this.write(`article:${article.id}`, article); }
  editions(): Edition[] { return this.list<Edition>('edition:').sort((a,b) => b.startedAt.localeCompare(a.startedAt)); }
  getDashboard(): DashboardState {
    const history = this.editions(); const edition = history[0] ?? null;
    const published = edition && !['ready','partial'].includes(edition.status) ? this.read<Edition>(`published:${edition.id}`) : null;
    return { edition, previous: published ?? history.find(e => e.id !== edition?.id && ['ready', 'partial'].includes(e.status)) ?? null, history: this.list<Edition>('published:').sort((a,b)=>b.localDate.localeCompare(a.localDate)), articles: this.list<Article>('article:'), profile: this.getProfile(), settings: this.getSettings(), connections: [], actions: this.list<ActionReceipt>('action:'),drafts:this.list<TaskDraft>('draft:').sort((a,b)=>b.plannedAt.localeCompare(a.plannedAt)) };
  }
}
