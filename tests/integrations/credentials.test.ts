import {expect,it} from 'vitest';
import {IntegrationService,modelCompletion} from '../../src/worker/integrations/credentials';
import {briefModel} from '../../src/worker/agent/openrouter';
const task={id:'one',title:'Read paper',description:'Source: https://example.com'};
it('pins the Todoist project and strips provider response fields',async()=>{
 let body:any;
 const service=new IntegrationService({TODOIST_TOKEN:'secret',TODOIST_PROJECT_ID:'fixed'},async(_url,init)=>{body=JSON.parse(String(init?.body));return Response.json({id:'one',url:'https://todoist.com/one',token:'never-return'});});
 expect(await service.createTodoistTask({task,actionKey:'todoist:draft:one',timeZone:'Asia/Kolkata'})).toEqual({ok:true,value:{externalId:'one',url:'https://todoist.com/one'}});
 expect(body.project_id).toBe('fixed');
});
it('rejects destination injection without network access',async()=>{
 let calls=0;const service=new IntegrationService({TODOIST_TOKEN:'secret',TODOIST_PROJECT_ID:'fixed'},async()=>{calls++;return Response.json({});});
 for(const input of [{task:{...task,projectId:'other'},actionKey:'x',timeZone:'UTC'},{task,actionKey:'x',timeZone:'UTC',url:'https://evil.example'}]){
  expect((await service.createTodoistTask(input)).ok).toBe(false);
 }
 expect((await service.saveArticle({article:{},summary:'x',parent:{database_id:'other'}})).ok).toBe(false);
 expect(calls).toBe(0);
});
it('sanitizes thrown provider errors and marks unknown write outcomes uncertain',async()=>{
 const service=new IntegrationService({TODOIST_TOKEN:'secret',TODOIST_PROJECT_ID:'fixed'},async()=>{throw new Error('secret https://credential.example');});
 expect(await service.createTodoistTask({task,actionKey:'x',timeZone:'UTC'})).toEqual({ok:false,safeToRetry:false,error:'Provider request failed. Check the destination before retrying.'});
});
it('does not retry a write when the provider returns a malformed receipt',async()=>{
 const service=new IntegrationService({TODOIST_TOKEN:'secret',TODOIST_PROJECT_ID:'fixed'},async()=>Response.json({accepted:true}));
 const outcome=await service.createTodoistTask({task,actionKey:'x',timeZone:'UTC'});
 expect(outcome).toMatchObject({ok:false,safeToRetry:false});
});
it('writes Notion pages only into the configured database data source',async()=>{
 let page:any;const paths:string[]=[];
 const service=new IntegrationService({NOTION_TOKEN:'secret',NOTION_DATABASE_ID:'fixed-db'},async(input,init)=>{
  const url=new URL(String(input));expect(url.origin).toBe('https://api.notion.com');paths.push(url.pathname);
  if(url.pathname==='/v1/databases/fixed-db')return Response.json({data_sources:[{id:'fixed-source'}]});
  if(url.pathname==='/v1/data_sources/fixed-source')return Response.json({properties:Object.fromEntries(Object.entries({Name:'title',URL:'url',Summary:'rich_text',Source:'rich_text',Published:'date',Saved:'date',Topics:'multi_select'}).map(([name,type])=>[name,{type}]))});
  if(url.pathname.endsWith('/query'))return Response.json({results:[]});
  page=JSON.parse(String(init?.body));return Response.json({id:'page',url:'https://notion.so/page',private:'secret'});
 });
 const input={article:{id:'one',title:'Research',url:'https://example.com',sources:['Lab'],topics:['agents']},summary:'Summary'};
 expect(await service.saveArticle(input)).toEqual({ok:true,value:{externalId:'page',url:'https://notion.so/page'}});
 expect(page.parent).toEqual({type:'data_source_id',data_source_id:'fixed-source'});
 expect(paths).toContain('/v1/databases/fixed-db');
 const count=paths.length;
 expect((await service.saveArticle({...input,databaseId:'other'})).ok).toBe(false);
 expect(paths).toHaveLength(count);
});
it('gateway fixes the endpoint, credentials and model and excludes upstream headers',async()=>{
 let request:Request|undefined;
 const response=await modelCompletion({model:briefModel.modelId,messages:[{role:'user',content:'Brief'}],stream:true,max_tokens:200},'secret',async(input,init)=>{request=new Request(input,init);return new Response('data: [DONE]\n\n',{headers:{'content-type':'text/event-stream','x-secret':'private'}});});
 expect(request!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
 expect(request!.headers.get('authorization')).toBe('Bearer secret');
 expect((await request!.json()).model).toBe(briefModel.modelId);
 expect(response.headers.get('x-secret')).toBeNull();
 expect(await response.text()).toContain('[DONE]');
});
it('gateway rejects alternate models, tools, routing fields and excessive output',async()=>{
 let calls=0;const http:typeof fetch=async()=>{calls++;return new Response('unexpected');};
 const base={model:briefModel.modelId,messages:[{role:'user',content:'Brief'}],stream:true};
 for(const change of [{model:'other'},{tools:[{name:'shell'}]},{provider:{order:['other']}},{max_tokens:999999},{url:'https://evil.example'}]){
  expect((await modelCompletion({...base,...change},'secret',http)).status).toBe(400);
 }
 expect(calls).toBe(0);
});
