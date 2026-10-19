import {expect,it} from 'vitest';
import {Application} from '../../src/worker/application';
import {BriefEngine} from '../../src/worker/briefs/engine';
import {BriefStore} from '../../src/worker/store';
import {BriefModel} from '../../src/worker/agent/model';
import {database} from '../helpers';
it('publishes a durable edition, learns feedback, and keeps provider writes behind confirmation',async()=>{
 const db=database();const store=new BriefStore(db);let writes=0;
 const model=new BriefModel({json:async(prompt)=>prompt.includes('Split the user')?{tasks:[{id:'read',title:'Read source',description:'Source'},{id:'reproduce',title:'Reproduce work',description:'Source',precedingTaskId:'read'}]}:{overview:'A new research result',groups:[{id:'g',headline:'Research result',summary:'Grounded summary',keyDetails:['Measured on a benchmark'],evidenceArticleIds:['a'],topics:['research']}]}});
 const engine=new BriefEngine(store,model,async()=>({articles:[{id:'a',url:'https://example.com/work',title:'Research result',sources:['Lab'],topics:[],content:'Measured on a benchmark',contentStatus:'excerpt'}],outcomes:[{sourceId:'hn',ok:true,count:1}],checkpoints:{hn:'2026-10-18T00:00:00Z'}}));
 await engine.run('owner:2026-10-18',false,new Date('2026-10-18T00:00:00Z'));
 const reopened=new BriefStore(db);expect(reopened.getDashboard().edition?.status).toBe('ready');expect(reopened.article('a')?.topics).toEqual(['research']);
 const app=new Application(reopened,model,{createTask:async()=>({externalId:String(++writes)}),reconcile:async()=>null},null,async()=>{},async()=>[]);
 await app.handle('/feedback','POST',{id:'feedback',kind:'more',targetId:'g',topics:['research'],at:'2026-10-18'});
 expect(reopened.getProfile().weights.research).toBeGreaterThan(0);
 const draft=await app.handle('/articles/a/task-drafts','POST',{instruction:'Read this article and reproduce the work'}) as any;
 expect(draft.tasks).toHaveLength(2);expect(writes).toBe(0);
 await app.handle(`/task-drafts/${draft.id}/confirm`,'POST',{expectedVersion:1});expect(writes).toBe(2);
 await expect(app.handle('/settings','POST',{})).rejects.toMatchObject({status:404});
});
it('preserves the same published edition during refresh and marks source failures as partial',async()=>{
 const store=new BriefStore(database());const model=new BriefModel({json:async()=>({overview:'Checked sources',groups:[]})});
 const engine=new BriefEngine(store,model,async()=>({articles:[],outcomes:[{sourceId:'hn',ok:false,count:0,error:'Unavailable'}],checkpoints:{}}));
 await engine.run('owner:2026-10-18',false,new Date());expect(store.getDashboard().edition?.status).toBe('partial');
 engine.start('owner:2026-10-18',true,new Date());expect(store.getDashboard().previous?.overview).toContain('No new articles');
});
it('freezes preferences and does not advance checkpoints before publication',async()=>{
 const store=new BriefStore(database());let received='';
 const model=new BriefModel({json:async(prompt)=>{received=prompt;throw new Error('Model offline');}});
 const engine=new BriefEngine(store,model,async()=>({articles:[{id:'a',title:'Agents',url:'https://example.com/agents',sources:['HN'],topics:['agents'],content:'Evidence',contentStatus:'excerpt'}],outcomes:[{sourceId:'hn',ok:true,count:1}],checkpoints:{hn:'2026-10-18T00:00:00Z'}}));
 engine.start('owner:2026-10-18',false,new Date());
 await new Application(store,model,{createTask:async()=>({externalId:'none'}),reconcile:async()=>null},null,async()=>{},async()=>[]).handle('/interests','PUT',{follows:['finance'],suppressions:[],reset:false});
 await expect(engine.run('owner:2026-10-18',false,new Date())).rejects.toThrow('Model offline');
 expect(store.read('checkpoints')).toBeNull();expect(store.read<any>('profile:0')?.follows).toEqual([]);
 expect(received).toContain('"follows":[]');
});
it('does not repeat unchanged undated publisher items on the following day',async()=>{
 const store=new BriefStore(database());let calls=0;
 const model=new BriefModel({json:async()=>{calls++;return {overview:'New work',groups:[{id:'g',headline:'Work',summary:'Summary',keyDetails:[],topics:[],evidenceArticleIds:['a']}]};}});
 const collect=async()=>({articles:[{id:'a',title:'Work',url:'https://example.com/work',sources:['Lab'],topics:[],content:'Evidence',contentStatus:'excerpt' as const}],outcomes:[{sourceId:'lab',ok:true,count:1}],checkpoints:{}});
 const engine=new BriefEngine(store,model,collect);await engine.run('owner:2026-10-18',false,new Date('2026-10-18T00:00:00Z'));await engine.run('owner:2026-10-19',false,new Date('2026-10-19T00:00:00Z'));
 expect(calls).toBe(1);expect(store.getDashboard().edition?.groups).toHaveLength(0);
});
