import { expect,it } from 'vitest';
import { TaskService } from '../../src/worker/tasks/service';
import { BriefStore } from '../../src/worker/store';
import { BriefModel } from '../../src/worker/agent/model';
import { database } from '../helpers';
const article={id:'article',title:'Reproducible agents',url:'https://example.com/agents',sources:['Research'],topics:['agents'],content:'A benchmark and source code.',contentStatus:'excerpt' as const};
const plan={tasks:[{id:'read',title:'Read Reproducible agents',description:'Read the work.',},{id:'reproduce',title:'Reproduce the work',description:'Run the described work.',precedingTaskId:'read'}]};
function setup(write: (task:any,key:string)=>Promise<any>){const store=new BriefStore(database());store.saveArticle(article);const model=new BriefModel({json:async()=>structuredClone(plan)});return {store,tasks:new TaskService(store,model,{createTask:write,reconcile:async()=>null})};}
it('splits the request into a preview, rejects stale edits and sends only confirmed tasks',async()=>{
 const sent:string[]=[];const {tasks}=setup(async(t)=>{sent.push(t.title);return {externalId:t.id,url:'https://app.todoist.com/'};});
 const draft=await tasks.planTasks({articleId:'article',instruction:'Read this article and reproduce the work'});
 expect(draft.tasks).toHaveLength(2);expect(sent).toEqual([]);expect(draft.tasks[1].description).toContain('https://example.com/agents');expect(draft.tasks[0].due).toBeUndefined();
 const edited=tasks.editDraft(draft.id,1,[draft.tasks[0]]);expect(edited.version).toBe(2);
 await expect(tasks.confirmDraft(draft.id,1)).rejects.toMatchObject({status:409});
 expect((await tasks.confirmDraft(draft.id,2))[0].status).toBe('succeeded');
 await tasks.confirmDraft(draft.id,2);expect(sent).toEqual(['Read Reproducible agents']);
});
it('does not resend a successful task after another response is lost',async()=>{
 const sent:string[]=[];const {tasks,store}=setup(async(t)=>{sent.push(t.id);if(t.id==='reproduce')throw new Error('connection lost');return {externalId:'created'};});
 const d=await tasks.planTasks({articleId:'article',instruction:'Read and reproduce'});
 expect((await tasks.confirmDraft(d.id,d.version)).map(r=>r.status)).toEqual(['succeeded','uncertain']);
 const reopened=new TaskService(store,new BriefModel({json:async()=>plan}),{createTask:async()=>{throw new Error('must not send');},reconcile:async()=>null});
 expect((await reopened.confirmDraft(d.id,d.version)).map(r=>r.status)).toEqual(['succeeded','uncertain']);expect(sent).toHaveLength(2);
});
it('guards concurrent confirmations and blocks invalid ordering',async()=>{
 let sends=0;let release!:()=>void;const wait=new Promise<void>(r=>release=r);
 const {tasks}=setup(async()=>{sends++;await wait;return {externalId:'one'};});const d=await tasks.planTasks({articleId:'article',instruction:'Read'});
 tasks.editDraft(d.id,1,[d.tasks[0]]);const first=tasks.confirmDraft(d.id,2);await tasks.confirmDraft(d.id,2);release();await first;expect(sends).toBe(1);
 const other=await tasks.planTasks({articleId:'article',instruction:'Read'});
 expect(()=>tasks.editDraft(other.id,1,[other.tasks[1]])).toThrow();
});
it('recovers the same draft and receipts after reload and uses its reviewed timezone',async()=>{
 const db=database();const store=new BriefStore(db);store.saveArticle(article);
 const model=new BriefModel({json:async()=>plan});let zone='';
 const first=new TaskService(store,model,{createTask:async(_t,_key,timeZone)=>{zone=timeZone??'';return {externalId:'created'};},reconcile:async()=>null});
 const d=await first.planTasks({articleId:'article',instruction:'Read and reproduce tomorrow'});
 store.saveSettings({...store.getSettings(),timeZone:'America/New_York'});
 await first.confirmDraft(d.id,1);expect(zone).toBe('Asia/Kolkata');
 const reopened=new TaskService(new BriefStore(db),model,{createTask:async()=>{throw new Error('must not resend');},reconcile:async()=>null});
 const snapshot=reopened.readDraft(d.id);expect(snapshot.draft.id).toBe(d.id);expect(snapshot.receipts.every(r=>r.status==='succeeded')).toBe(true);
 expect(store.getDashboard().drafts.find(d=>d.id===snapshot.draft.id)).toBeDefined();
});
