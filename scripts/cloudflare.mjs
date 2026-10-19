import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('../cloudflare/',import.meta.url));
const cli=fileURLToPath(new URL('../cloudflare/node_modules/wrangler/bin/wrangler.js',import.meta.url));
const configs=['credentials/wrangler.jsonc','pi/wrangler.jsonc','../wrangler.jsonc'];
const action=process.argv[2];
if(!['dev','check','deploy'].includes(action))throw new Error('Use dev, check, or deploy.');
const commands=action==='dev'?[['dev',...configs.toReversed().flatMap(config=>['--config',config])]]:configs.map(config=>['deploy',...(action==='check'?['--dry-run']:[]),'--config',config]);
for(const args of commands){
 const result=spawnSync(process.execPath,[cli,...args],{cwd:directory,stdio:'inherit',env:{...process.env,CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'}});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
