import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Export the production dashboard bundle; only its initial data differs.
/** @param {string} output
 * @param {{directory?: string, snapshot?: import('../src/shared/contracts').DashboardState, demo?: boolean}} options */
export async function exportDashboard(output, { directory = 'dist', snapshot, demo = false } = {}) {
  const index = await readFile(resolve(directory, 'index.html'), 'utf8');
  const script = index.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/)?.[1];
  const stylesheet = index.match(/<link[^>]*href="([^"]+\.css)"[^>]*>/)?.[1];
  if (!script || !stylesheet) throw new Error('Build the dashboard before exporting it.');
  const js = await readFile(resolve(directory, script.replace(/^\//, '')), 'utf8');
  const css = await readFile(resolve(directory, stylesheet.replace(/^\//, '')), 'utf8');
  const bootstrap = snapshot !== undefined
    ? `window.__BRIEF_SNAPSHOT__=${JSON.stringify(snapshot).replace(/</g, '\\u003c')};`
    : demo ? "if(!location.search.includes('demo=1'))location.replace(location.href.split('?')[0].split('#')[0]+'?demo=1');" : '';
  const html = index
    .replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script>${bootstrap}</script><script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`)
    .replace(/<link[^>]*href="[^"]+\.css"[^>]*>/, () => `<style>${css}</style>`);
  await writeFile(output, html);
}
