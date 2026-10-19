import { expect, it } from 'vitest';
import { Application } from '../../src/worker/application';
import { BriefStore } from '../../src/worker/store';
import { BriefModel } from '../../src/worker/agent/model';
import { database } from '../helpers';
import { createLocalHandler } from '../../src/local/server';

it('serves the saved dashboard and routes task previews through the shared application', async () => {
 const store = new BriefStore(database());
 store.saveArticle({id:'a',title:'Saved research',url:'https://example.com/research',sources:['HN'],topics:[],content:'Evidence',contentStatus:'excerpt'});
 let creates=0;
 const app=new Application(store,new BriefModel({json:async()=>({tasks:[{id:'read',title:'Read research',description:'https://example.com/research'},{id:'reproduce',title:'Reproduce work',description:'https://example.com/research',precedingTaskId:'read'}]})}),{createTask:async()=>{creates++;return {externalId:'task'};},reconcile:async()=>null},null,async()=>{throw new Error('Must not refresh while viewing');},async()=>[]);
 const origin='http://127.0.0.1:4180';const handle=createLocalHandler(app,'dist',origin);
 const dashboard=await handle(new Request(`${origin}/api/dashboard`,{headers:{Host:'127.0.0.1:4180'}}));
 expect(dashboard.status).toBe(200);
 expect((await dashboard.json()).data.articles[0].title).toBe('Saved research');
 const preview=await handle(new Request(`${origin}/api/articles/a/task-drafts`,{method:'POST',headers:{Host:'127.0.0.1:4180',Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({instruction:'Read this article and reproduce its work'})}));
 expect(preview.status).toBe(200);
 expect((await preview.json()).data.tasks.map((t:any)=>t.title)).toEqual(['Read research','Reproduce work']);
 expect(creates).toBe(0);
});

it('rejects foreign origins, foreign hostnames, oversized bodies and invalid JSON before mutation',async()=>{
 const store=new BriefStore(database());
 const app=new Application(store,new BriefModel({json:async()=>null}),{createTask:async()=>({externalId:''}),reconcile:async()=>null},null,async()=>{},async()=>[]);
 const origin='http://127.0.0.1:4180';const handle=createLocalHandler(app,'dist',origin);
 for(const [headers,body,status] of [
  [{Host:'127.0.0.1:4180',Origin:'https://foreign.example'},'{}',403],
  [{Host:'foreign.example',Origin:origin},'{}',403],
  [{Host:'127.0.0.1:4180',Origin:origin},'a'.repeat(65537),413],
  [{Host:'127.0.0.1:4180',Origin:origin},'{',400],
 ] as const){
  const result=await handle(new Request(`${origin}/api/settings`,{method:'PUT',headers,body}));
  expect(result.status).toBe(status);
 }
 expect(store.read('settings')).toBeNull();
});
