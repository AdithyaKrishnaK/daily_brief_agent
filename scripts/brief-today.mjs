import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { build as buildDashboard } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir('.local-brief', { recursive: true, mode: 0o700 });
await buildDashboard();
await build({ entryPoints: ['src/local/run.ts'], outfile: '.local-brief/run.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external' });
try {
  const { run } = await import('../.local-brief/run.mjs');
  await run();
} catch (error) {
  console.error(`\nBrief generation failed: ${error.message}`);
  process.exitCode = 1;
}
