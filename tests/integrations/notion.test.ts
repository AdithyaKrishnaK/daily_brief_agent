import { expect,it } from 'vitest';
import { NotionAdapter, NotionSaves } from '../../src/worker/integrations/notion';
import { BriefStore } from '../../src/worker/store';
import { database } from '../helpers';
const article={id:'one',title:'Research',url:'https://example.com/work',sources:['Lab'],topics:['agents'],content:'Publisher content must not be copied.',contentStatus:'excerpt' as const};
it('validates schema, saves summaries and returns an existing page after repeat clicks',async()=>{
 const store=new BriefStore(database());store.saveArticle(article);let creates=0;let payload:any;
 const adapter=new NotionAdapter('token','database',async(url,options)=>{
  const path=new URL(String(url)).pathname;
  if(path==='/v1/databases/database')return Response.json({data_sources:[{id:'data'}]});
  if(path==='/v1/data_sources/data')return Response.json({properties:{Name:{type:'title'},URL:{type:'url'},Summary:{type:'rich_text'},Source:{type:'rich_text'},Published:{type:'date'},Saved:{type:'date'},Topics:{type:'multi_select'}}});
  if(path.endsWith('/query'))return Response.json({results:[]});
  creates++;payload=JSON.parse(String(options?.body));return Response.json({id:'page',url:'https://notion.so/page'});
 });
 const service=new NotionSaves(store,adapter);const first=await service.saveArticleToNotion('one');await service.saveArticleToNotion('one');
 expect(first.url).toBe('https://notion.so/page');expect(creates).toBe(1);expect(payload.parent.data_source_id).toBe('data');expect(payload.properties.URL.url).toBe(article.url);expect(JSON.stringify(payload)).not.toContain(article.content);
});
it('reconciles a lost create response without creating a second page',async()=>{
 const store=new BriefStore(database());store.saveArticle(article);let exists=false;let creates=0;
 const adapter=new NotionAdapter('token','database',async(url)=>{
  const path=new URL(String(url)).pathname;
  if(path.includes('/databases/'))return Response.json({data_sources:[{id:'data'}]});
  if(path==='/v1/data_sources/data')return Response.json({properties:{Name:{type:'title'},URL:{type:'url'},Summary:{type:'rich_text'},Source:{type:'rich_text'},Published:{type:'date'},Saved:{type:'date'},Topics:{type:'multi_select'}}});
  if(path.endsWith('/query'))return Response.json({results:exists?[{id:'page',url:'https://notion.so/page'}]:[]});
  creates++;exists=true;throw new Error('response lost');
 });
 const service=new NotionSaves(store,adapter);expect((await service.saveArticleToNotion('one')).status).toBe('uncertain');expect((await service.saveArticleToNotion('one')).status).toBe('succeeded');expect(creates).toBe(1);
});
it('rejects an inaccessible or incompatible destination',async()=>{
 const adapter=new NotionAdapter('token','database',async(url)=>String(url).includes('/databases/')?Response.json({data_sources:[{id:'data'}]}):Response.json({properties:{Name:{type:'title'}}}));
 await expect(adapter.validateDestination()).rejects.toThrow('URL');
});
