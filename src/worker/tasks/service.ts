import { AppError, DraftTaskSchema, type TaskDraft, type DraftTask,type ActionReceipt } from '../../shared/contracts';
import { BriefStore } from '../store';
import { BriefModel } from '../agent/model';
import { Actions } from '../integrations/actions';
import type { TaskDestination } from '../integrations/todoist';
import { Preferences } from '../preferences/profile';
export class TaskService {
 private actions:Actions;
 constructor(private store:BriefStore,private model:BriefModel,private destination:TaskDestination){this.actions=new Actions(store);}
 private get(id:string){const d=this.store.read<TaskDraft>(`draft:${id}`);if(!d)throw new AppError(404,'missing_draft','Task preview not found.');return d;}
 readDraft(id:string){const draft=this.get(id);return {draft,receipts:draft.tasks.map(task=>this.store.read<ActionReceipt>(`action:todoist:${id}:${task.id}`)??{key:`todoist:${id}:${task.id}`,provider:'todoist' as const,status:'pending' as const,fingerprint:JSON.stringify(task)})};}
 private validTasks(tasks:DraftTask[]){const result=DraftTaskSchema.array().min(1).max(12).parse(tasks);const seen=new Set<string>();for(const t of result){if(seen.has(t.id)||(t.precedingTaskId&&!seen.has(t.precedingTaskId)))throw new AppError(422,'invalid_order','Review task order and dependencies.');seen.add(t.id);}return result;}
 async planTasks(input:{articleId:string;instruction:string}){
  const article=this.store.article(input.articleId);if(!article)throw new AppError(404,'missing_article','Article not found.');
  const timeZone=this.store.getSettings().timeZone;const plannedAt=new Date().toISOString();const id=crypto.randomUUID();const generated=await this.model.generateTasks(article,input.instruction,timeZone,`draft:${id}`,this.store.getProfile().taskStyle);
  const draft:TaskDraft={id,articleId:article.id,version:1,instruction:input.instruction,tasks:generated.tasks.map(t=>({...t,description:`${t.description}\n\nSource: ${article.url}${t.precedingTaskId?`\nAfter: ${generated.tasks.find(p=>p.id===t.precedingTaskId)?.title??'the preceding task'}`:''}`})),status:'draft',clarification:generated.clarification,timeZone,plannedAt};
  if(draft.tasks.length)this.validTasks(draft.tasks);this.store.write(`draft:${id}`,draft);return draft;
 }
 editDraft(id:string,version:number,tasks:DraftTask[]){const d=this.get(id);if(d.version!==version||d.status==='confirmed')throw new AppError(409,'stale_draft','This preview changed or was confirmed. Open a new preview.');const article=this.store.article(d.articleId)!;const edited={...d,version:d.version+1,tasks:this.validTasks(tasks).map(t=>({...t,description:t.description.includes(article.url)?t.description:`${t.description}\n\nSource: ${article.url}`}))};this.store.write(`draft:${id}`,edited);new Preferences(this.store).recordFeedback({id:`edit:${id}:${edited.version}`,kind:'task-edit',targetId:id,topics:[],payload:JSON.stringify({instruction:d.instruction,before:d.tasks,after:edited.tasks}).slice(0,2000),at:new Date().toISOString()});return edited;}
 async confirmDraft(id:string,version:number){
  const draft=this.get(id);if(draft.version!==version)throw new AppError(409,'stale_draft','This preview changed. Review the latest version.');if(draft.clarification||!draft.tasks.length)throw new AppError(422,'clarification_needed',draft.clarification??'Add a task before confirming.');
  this.validTasks(draft.tasks);this.store.write(`draft:${id}`,{...draft,status:'confirmed'});
  const receipts=[];
  for(const task of draft.tasks){const key=`todoist:${id}:${task.id}`;receipts.push(await this.actions.deliver(key,'todoist',JSON.stringify(task),()=>this.destination.createTask(task,key,draft.timeZone),()=>this.destination.reconcile(key)));}
  if(receipts.some(r=>r.status==='succeeded'))new Preferences(this.store).recordFeedback({id:`confirmed:${id}`,kind:'task',targetId:id,topics:[],at:new Date().toISOString()});return receipts;
 }
}
