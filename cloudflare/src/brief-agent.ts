import {assertNoProviderSecrets} from '../../src/worker/agent/secret-boundary';
import {NotionSaves} from '../../src/worker/integrations/notion';
import type {TaskDestination} from '../../src/worker/integrations/todoist';
import {unwrapOutcome} from '../../src/worker/integrations/credentials';
import { Agent } from 'agents';
import { BriefStore } from '../../src/worker/store';
import { BriefModel } from '../../src/worker/agent/model';
import { BriefEngine } from '../../src/worker/briefs/engine';
import { Application } from '../../src/worker/application';
import { scheduledEdition,localDate } from '../../src/worker/briefs/schedule';
import type { ConnectionStatus } from '../../src/shared/contracts';
import type { Env } from './env';
import {rpcResult} from '../../src/worker/http';
import {RunAdmission} from '../../src/worker/briefs/admission';

export class BriefAgent extends Agent<Env> {
 private store:BriefStore;
 private model:BriefModel;
 private engine:BriefEngine;
 private application:Application;
 #notionSaves?:{databaseId:string;saves:NotionSaves};
 constructor(ctx:DurableObjectState,env:Env){
  super(ctx,env);assertNoProviderSecrets(env);this.store=new BriefStore(ctx.storage);
  this.model=new BriefModel({json:(prompt,key)=>env.PI.json(prompt,key)});this.engine=new BriefEngine(this.store,this.model);
  const todoist:TaskDestination={
   createTask:async(task,actionKey,timeZone)=>unwrapOutcome(await env.INTEGRATIONS.createTodoistTask({task,actionKey,timeZone:timeZone??this.store.getSettings().timeZone})),
   reconcile:async()=>null
  };
  const notion={saveArticleToNotion:async(articleId:string)=>{
   const {databaseId}=await env.INTEGRATIONS.destination();
   if(!this.#notionSaves||this.#notionSaves.databaseId!==databaseId)this.#notionSaves={databaseId,saves:new NotionSaves(this.store,{
    databaseId,
    find:async(url)=>unwrapOutcome(await env.INTEGRATIONS.findSavedArticle({url})),
    create:async(article,summary)=>{
     const {id,title,url,sources,publishedAt,topics}=article;
     return unwrapOutcome(await env.INTEGRATIONS.saveArticle({article:{id,title,url,sources,publishedAt,topics},summary}));
    }
   })};
   return this.#notionSaves.saves.saveArticleToNotion(articleId);
  }};
  this.application=new Application(this.store,this.model,todoist,notion,()=>this.enqueue(true),()=>this.connections());
 }
 async dispatchScheduled(time:number){
  // Recover unfinished editions independently of the current time-zone window.
  for(const edition of this.store.editions().filter(e=>e.status==='running'))await this.schedule(1,'runEdition',{id:edition.id,revision:edition.revision},{idempotent:true});
  const due=scheduledEdition(this.store.getSettings(),new Date(time));if(due)return this.enqueue(false,due.editionId);
 }
 async enqueue(refresh:boolean,id?:string){
  const editionId=id??`owner:${localDate(this.store.getSettings().timeZone,new Date())}`;
  const existing=this.store.read<any>(`edition:${editionId}`);
  if(existing&&!refresh&&['ready','partial','failed'].includes(existing.status))return existing;
  const edition=this.engine.start(editionId,refresh,new Date());
  await this.schedule(1,'runEdition',{id:editionId,revision:edition.revision},{idempotent:true});return edition;
 }
 async runEdition(payload:{id:string;revision:number}){
  const gate=new RunAdmission(this.store);const admission=gate.admit(payload.id,payload.revision,Date.now());
  if(admission.status==='exhausted'){this.engine.fail(payload.id,'The brief could not finish after three attempts. Refresh to try again.');return;}
  if(admission.status!=='admitted')return;
  try{await this.engine.run(payload.id,false,new Date());gate.release(payload.id,payload.revision,admission.token);}
  catch{const delay=60*2**(admission.attempt-1);gate.release(payload.id,payload.revision,admission.token,Date.now()+delay*1000);if(admission.attempt<3)await this.schedule(delay,'runEdition',payload);else this.engine.fail(payload.id,'The brief could not finish. Check source and model connections.');}
 }
 async handleApi(path:string,method:string,body:unknown){return rpcResult(()=>this.application.handle(path,method,body));}
 async connections():Promise<ConnectionStatus[]>{
  const existing=this.store.read<{at:number;statuses:ConnectionStatus[]}>('connections');if(existing&&Date.now()-existing.at<60000)return existing.statuses;
  const {statuses}=await this.env.INTEGRATIONS.connections();
  this.store.write('connections',{at:Date.now(),statuses});return statuses;
 }
}
