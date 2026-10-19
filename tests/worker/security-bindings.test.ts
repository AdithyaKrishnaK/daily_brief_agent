import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
it('gives Pi only model authority and keeps credential workers private',()=>{
 const app=JSON.parse(read('wrangler.jsonc'));
 const pi=JSON.parse(read('cloudflare/pi/wrangler.jsonc'));
 const credentials=JSON.parse(read('cloudflare/credentials/wrangler.jsonc'));
 expect(app.services).toEqual([{binding:'PI',service:'morning-paper-pi',entrypoint:'PiService'},{binding:'INTEGRATIONS',service:'morning-paper-credentials',entrypoint:'IntegrationWrites'}]);
 expect(pi.services).toEqual([{binding:'MODEL_GATEWAY',service:'morning-paper-credentials',entrypoint:'ModelGateway'}]);
 for(const config of [pi,credentials]){
  expect(config.workers_dev).toBe(false);expect(config.preview_urls).toBe(false);expect(config.routes??[]).toEqual([]);
  expect(config.vars??{}).toEqual({});
 }
 const runtime=read('cloudflare/src/pi.ts')+read('cloudflare/src/env.ts')+read('cloudflare/src/brief-agent.ts');
 expect(runtime).not.toMatch(/OPENROUTER_API_KEY|TODOIST_TOKEN|NOTION_TOKEN|process\.env/);
 expect(read('cloudflare/src/pi.ts')).not.toMatch(/INTEGRATIONS|IntegrationWrites|handleApi/);
});
