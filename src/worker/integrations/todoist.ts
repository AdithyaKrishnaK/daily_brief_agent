import { DraftTaskSchema, type DraftTask } from '../../shared/contracts';
import { ProviderError, type ProviderWriteResult } from './actions';
export interface TaskDestination { createTask(task: DraftTask,actionKey: string,timeZone?:string):Promise<ProviderWriteResult>;reconcile(actionKey: string):Promise<ProviderWriteResult|null> }
export class TodoistAdapter implements TaskDestination {
 constructor(private token:string,private timeZone:string,private projectId:string,private http:typeof fetch=fetch){}
 async createTask(task:DraftTask,actionKey:string,timeZone=this.timeZone){
  task=DraftTaskSchema.parse(task);
  if(!this.projectId.trim())throw new ProviderError('Set TODOIST_PROJECT_ID in server configuration.',true);
  if(!this.token)throw new ProviderError('Connect Todoist in setup first.',true);
  const response=await this.http('https://api.todoist.com/api/v1/tasks',{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json','X-Request-Id':actionKey},signal:AbortSignal.timeout(15000),body:JSON.stringify({content:task.title,description:task.description, ...(task.due?{due_string:task.due,due_timezone:timeZone}:{}),...(task.priority?{priority:task.priority}:{}),project_id:this.projectId})});
  if(!response.ok)throw new ProviderError(`Todoist returned ${response.status}.`,response.status>=400&&response.status<500&&response.status!==409);
  const result=await response.json() as {id:string;url?:string};return {externalId:result.id,url:result.url};
 }
 async reconcile(_actionKey:string):Promise<ProviderWriteResult|null>{return null;}
 async check(){if(!this.token||!this.projectId.trim())return false;const r=await this.http(`https://api.todoist.com/api/v1/projects/${encodeURIComponent(this.projectId)}`,{headers:{Authorization:`Bearer ${this.token}`},signal:AbortSignal.timeout(10000)});return r.ok;}
}
