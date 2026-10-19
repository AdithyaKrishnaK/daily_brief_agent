import {z,ZodError} from 'zod';
import {DraftTaskSchema,type ConnectionStatus} from '../../shared/contracts';
import {ProviderError,type ProviderWriteResult} from './actions';
import {TodoistAdapter} from './todoist';
import {NotionAdapter} from './notion';
import {briefModel} from '../agent/openrouter';

export interface CredentialEnv {
 OPENROUTER_API_KEY?:string;TODOIST_TOKEN?:string;TODOIST_PROJECT_ID?:string;
 NOTION_TOKEN?:string;NOTION_DATABASE_ID?:string;NOTION_DATA_SOURCE_ID?:string;
}
export type WriteOutcome<T>={ok:true;value:T}|{ok:false;error:string;safeToRetry:boolean};
export function unwrapOutcome<T>(outcome:WriteOutcome<T>):T {
 if(!outcome.ok)throw new ProviderError(outcome.error,outcome.safeToRetry);
 return outcome.value;
}
const timeZone=z.string().max(100).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}});
const publicUrl=z.url().refine(v=>{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;});
const articleInput=z.object({id:z.string().min(1).max(200),title:z.string().min(1).max(1000),url:publicUrl,sources:z.array(z.string().max(200)).max(20),publishedAt:z.iso.datetime().optional(),topics:z.array(z.string().max(100)).max(20)}).strict();
const receiptSchema=z.object({externalId:z.string().min(1).max(500),url:publicUrl.optional()});
function receipt(input:unknown):ProviderWriteResult{
 const parsed=receiptSchema.safeParse(input);
 if(!parsed.success)throw new Error('Invalid provider receipt.');
 return parsed.data;
}

// No generic request method: destination, paths, headers, and credentials are host-owned.
export class IntegrationService {
 #env:CredentialEnv;#http:typeof fetch;
 constructor(env:CredentialEnv,http:typeof fetch=fetch){this.#env=env;this.#http=http;}
 async #result<T>(operation:()=>Promise<T>):Promise<WriteOutcome<T>>{
  try{return {ok:true,value:await operation()};}
  catch(error){
   if(error instanceof ZodError)return {ok:false,error:'Invalid scoped operation input.',safeToRetry:true};
   if(error instanceof ProviderError)return {ok:false,error:error.message,safeToRetry:error.safeToRetry};
   return {ok:false,error:'Provider request failed. Check the destination before retrying.',safeToRetry:false};
  }
 }
 #todoist(){return new TodoistAdapter(this.#env.TODOIST_TOKEN??'','UTC',this.#env.TODOIST_PROJECT_ID??'',this.#http);}
 #notion(){return new NotionAdapter(this.#env.NOTION_TOKEN??'',this.#env.NOTION_DATABASE_ID??'',this.#http,this.#env.NOTION_DATA_SOURCE_ID);}
 createTodoistTask(input:unknown):Promise<WriteOutcome<ProviderWriteResult>>{
  return this.#result(async()=>{
   const {task,actionKey,timeZone:zone}=z.object({task:DraftTaskSchema,actionKey:z.string().min(1).max(500),timeZone}).strict().parse(input);
   return receipt(await this.#todoist().createTask(task,actionKey,zone));
  });
 }
 saveArticle(input:unknown):Promise<WriteOutcome<ProviderWriteResult>>{
  return this.#result(async()=>{
   const {article,summary}=z.object({article:articleInput,summary:z.string().max(20000)}).strict().parse(input);
   const adapter=this.#notion();
   return receipt(await adapter.find(article.url)??await adapter.create({...article,content:'',contentStatus:'excerpt'},summary));
  });
 }
 // Narrow duplicate reconciliation in the configured database; no general reads.
 findSavedArticle(input:unknown):Promise<WriteOutcome<ProviderWriteResult|null>>{
  return this.#result(async()=>{const {url}=z.object({url:publicUrl}).strict().parse(input);const result=await this.#notion().find(url);return result?receipt(result):null;});
 }
 async connections():Promise<{databaseId:string;statuses:ConnectionStatus[]}>{
  const statuses:ConnectionStatus[]=[{name:'Model',configured:Boolean(this.#env.OPENROUTER_API_KEY),detail:'DeepSeek via private OpenRouter gateway'}];
  try{const configured=await this.#todoist().check();statuses.push({name:'Todoist',configured,detail:configured?'Configured project connected':'Set TODOIST_TOKEN and TODOIST_PROJECT_ID on the credentials Worker'});}catch{statuses.push({name:'Todoist',configured:false,detail:'Could not verify the configured Todoist project'});}
  try{statuses.push(await this.#notion().validateDestination());}catch{statuses.push({name:'Notion',configured:false,detail:'Check credentials, database sharing, and required properties on the credentials Worker'});}
  return {databaseId:this.#env.NOTION_DATABASE_ID??'',statuses};
 }
}

// Accept only the subset Pi needs. Never accept upstream URLs, headers, tools,
// provider routing, or arbitrary token budgets from the Pi Worker.
const completionSchema=z.object({
 model:z.literal(briefModel.modelId),messages:z.array(z.object({role:z.enum(['system','user','assistant']),content:z.string().max(150000)}).strict()).min(1).max(100),
 store:z.literal(false).optional(),stream:z.literal(true),stream_options:z.object({include_usage:z.boolean()}).strict().optional(),
 max_tokens:z.number().int().positive().max(16384).optional(),max_completion_tokens:z.number().int().positive().max(16384).optional(),
 temperature:z.number().min(0).max(2).optional(),top_p:z.number().min(0).max(1).optional(),
 reasoning:z.object({effort:z.enum(['low','medium','high']),enabled:z.boolean().optional()}).strict().optional(),
}).strict();
export async function modelCompletion(input:unknown,key:string|undefined,http:typeof fetch=fetch):Promise<Response>{
 const parsed=completionSchema.safeParse(input);
 if(!parsed.success||JSON.stringify(input).length>200000)return Response.json({error:'Invalid model request.'},{status:400});
 if(!key)return Response.json({error:'Model gateway is not configured.'},{status:503});
 try{
  const {max_tokens,max_completion_tokens,...payload}=parsed.data;
  const response=await http('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({...payload,max_completion_tokens:max_tokens??max_completion_tokens??16384}),signal:AbortSignal.timeout(9*60000)});
  if(!response.ok)return Response.json({error:'Model provider request failed.'},{status:502});
  return new Response(response.body,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Model provider request failed.'},{status:502});}
}
