import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { exportDashboard } from '../../scripts/export-dashboard.mjs';

it('embeds live data safely in the same dashboard bundle', async () => {
 const directory = await mkdtemp(join(tmpdir(), 'brief-export-'));
 try {
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<html><link href="/assets/app.css" rel="stylesheet"><div id="root"></div><script type="module" src="/assets/app.js"></script></html>');
  await writeFile(join(directory, 'assets/app.js'), 'window.dashboardLoaded=true;');
  await writeFile(join(directory, 'assets/app.css'), 'body{color:olive}');
  const snapshot = { edition: { overview: '</script><script>bad()</script> $&' } };
  const output = join(directory, 'brief.html');
  await exportDashboard(output, { directory, snapshot });
  const html = await readFile(output, 'utf8');
  const context = { window: {} };
  runInNewContext(html.match(/<script>(.*?)<\/script>/s)[1], context);
  expect(JSON.stringify(context.window.__BRIEF_SNAPSHOT__)).toBe(JSON.stringify(snapshot));
  expect(html).not.toContain('<script>bad()');
  expect(html).toContain('window.dashboardLoaded=true;');
  expect(html).toContain('body{color:olive}');
  expect(html).not.toContain('demo=1');
 } finally { await rm(directory, { recursive: true, force: true }); }
});
