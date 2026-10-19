import { DatabaseSync } from 'node:sqlite';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createBriefModels, briefModel } from '../worker/agent/openrouter';
import { AssistantEntry, createRegistry, Harness } from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { BriefStore } from '../worker/store';
import { BriefModel } from '../worker/agent/model';
import { BriefEngine } from '../worker/briefs/engine';
import { localDate } from '../worker/briefs/schedule';
import { exportDashboard } from '../../scripts/export-dashboard.mjs';
import { sqliteStorage } from './sqlite';
import { Application } from '../worker/application';
import { TodoistAdapter } from '../worker/integrations/todoist';
import { NotionAdapter, NotionSaves } from '../worker/integrations/notion';
import { startLocalServer } from './server';

export async function run() {
  const directory = resolve('.local-brief');
  const lock = join(directory, 'run.lock');
  try { await mkdir(lock); } catch { throw new Error('A local run may already be active. If it has stopped, remove .local-brief/run.lock and retry.'); }
  const db = new DatabaseSync(join(directory, 'brief.sqlite'));
  const store = new BriefStore(sqliteStorage(db));
  try {
    const port = { async json(prompt: string, key: string) {
      const models = createBriefModels(process.env.OPENROUTER_API_KEY ?? '');
      const { provider, modelId } = briefModel;
      console.log(`Generating with Pi Durable: ${provider}/${modelId}`);
      const session = join(directory, `session-${createHash('sha256').update(`${modelId}:${key}`).digest('hex').slice(0, 24)}.sqlite`);
      const context = BACKGROUND_CONTEXT;
      const harness = await Harness.open(await openNodeSqliteStorage(session), { models, registry: createRegistry(), settings: { retry: { maxRetries: 1 } } }, context);
      try {
        const conversation = await harness.root(context, { agent: { model: { provider, modelId }, thinkingLevel: 'low', tools: [] } });
        const submission = await conversation.submit({ type: 'input', content: prompt, requestId: key }, context);
        const settled = await submission.wait(context);
        if (settled.status !== 'done' || settled.type !== 'input') throw new Error(`Model run ended without an answer (${settled.status}). Check OpenRouter access and account credit.`);
        const answer = await conversation.commit(tx => tx.entry(AssistantEntry, settled.answer), context);
        const message = answer?.model?.[0];
        if (!message || message.role !== 'assistant') throw new Error('Pi Durable returned no assistant response.');
        const text = message.content.filter(part => part.type === 'text').map(part => part.text).join('\n').trim();
        return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
      } finally { await harness.close(context); }
    } };
    const model = new BriefModel(port);
    const engine = new BriefEngine(store, model);
    const renderOnly = process.argv.includes('--render-only');
    let edition;
    if (renderOnly) {
      edition = store.getDashboard().history[0];
      if (!edition) throw new Error('No saved brief is available. Generate the first brief with npm run brief:today.');
      console.log('Using the saved brief. No feed collection or model generation.');
    } else {
      console.log('Collecting Hacker News, TechCrunch, Anthropic and OpenAI…');
      const now = new Date();
      const id = `owner:${localDate(store.getSettings().timeZone, now)}`;
      const existing = store.getDashboard().history.find(edition => edition.id === id);
      try {
        edition = await engine.run(id, process.argv.includes('--refresh') || !existing, now);
      } catch (error) {
        engine.fail(id, error instanceof Error ? error.message : 'Local run failed');
        throw error;
      }
    }
    if (!edition) throw new Error('The brief is already running.');
    const base = join(directory, `brief-${edition.localDate}`);
    if (!renderOnly) await writeFile(`${base}.json`, JSON.stringify(store.getDashboard(), null, 2));
    await exportDashboard(`${base}.html`, { snapshot: store.getDashboard() });
    console.log(`\n${edition.overview}\n\nHTML: ${base}.html\nJSON: ${base}.json`);
    if (process.argv.includes('--serve')) {
      const todoist = new TodoistAdapter(process.env.TODOIST_TOKEN ?? '', store.getSettings().timeZone, process.env.TODOIST_PROJECT_ID ?? '');
      const notion = new NotionAdapter(process.env.NOTION_TOKEN ?? '', process.env.NOTION_DATABASE_ID ?? '', fetch, process.env.NOTION_DATA_SOURCE_ID);
      const application = new Application(store, model, todoist, new NotionSaves(store, notion), async () => {
        const now = new Date();
        const id = `owner:${localDate(store.getSettings().timeZone, now)}`;
        const started = engine.start(id, true, now);
        void engine.run(id, false, now).catch(error => engine.fail(id, error instanceof Error ? error.message : 'Refresh failed'));
        return started;
      }, async () => [
        {name:'Model',configured:Boolean(process.env.OPENROUTER_API_KEY),detail:'DeepSeek V4.1 Flash via OpenRouter'},
        {name:'Todoist',configured:Boolean(process.env.TODOIST_TOKEN && process.env.TODOIST_PROJECT_ID),detail:process.env.TODOIST_TOKEN && process.env.TODOIST_PROJECT_ID?'Token configured; task creation verifies access':'Set TODOIST_TOKEN and TODOIST_PROJECT_ID in .env, then restart the local app.'},
        {name:'Notion',configured:Boolean(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID),detail:process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID?'Destination configured; saving verifies access and database properties':'Set NOTION_TOKEN and NOTION_DATABASE_ID in .env, then restart the local app.'}
      ]);
      const {origin,server} = await startLocalServer(application, 'dist', Number(process.env.BRIEF_PORT ?? 4180));
      console.log(`\nInteractive brief: ${origin}\nKeep this terminal running. Press Ctrl+C to stop.`);
      const stop = () => { server.close(); server.closeIdleConnections(); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      try {
        if (process.argv.includes('--open')) await openBrowser(origin);
        await new Promise<void>(resolveClosed => server.once('close', resolveClosed));
      } finally {
        process.off('SIGINT', stop); process.off('SIGTERM', stop); server.close();
      }
    } else if (process.argv.includes('--open')) await openBrowser(`${base}.html`);
  } finally { db.close(); await rm(lock, { recursive: true }); }
}

async function openBrowser(target: string) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  await new Promise<void>((opened, reject) => {
    const child = spawn(command, [target], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? opened() : reject(new Error(`Open ${target} manually.`)));
  });
}
