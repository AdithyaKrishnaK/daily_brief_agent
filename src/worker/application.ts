import { z } from 'zod';
import { AppError,FeedbackSchema,SettingsSchema,DraftTaskSchema,type ConnectionStatus } from '../shared/contracts';
import { BriefStore } from './store';
import { BriefModel } from './agent/model';
import { TaskService } from './tasks/service';
import { Preferences } from './preferences/profile';
import type { TaskDestination } from './integrations/todoist';
import type { NotionSaves } from './integrations/notion';
export class Application {
 private tasks:TaskService;private prefs:Preferences;
 constructor(private store:BriefStore,model:BriefModel,destination:TaskDestination,private notion:Pick<NotionSaves,'saveArticleToNotion'>|null,private refresh:()=>Promise<unknown>,private connections:()=>Promise<ConnectionStatus[]>){this.tasks=new TaskService(store,model,destination);this.prefs=new Preferences(store);}
 async handle(path:string,method:string,body:unknown):Promise<unknown>{
  if(path==='/dashboard'&&method==='GET')return {...this.store.getDashboard(),connections:await this.connections()};
  if(path==='/connections'&&method==='GET')return this.connections();
  if(path==='/refresh'&&method==='POST')return this.refresh();
  if(path==='/settings'&&method==='PUT'){const settings=SettingsSchema.parse(body);this.store.saveSettings(settings);return settings;}
  if(path==='/feedback'&&method==='POST')return this.prefs.recordFeedback(FeedbackSchema.parse(body));
  if(path.startsWith('/feedback/')&&method==='DELETE')return this.prefs.removeEvidence(decodeURIComponent(path.slice('/feedback/'.length)));
  if(path==='/interests'&&method==='PUT')return this.prefs.updateInterests(z.object({follows:z.array(z.string().min(1).max(100)).max(100),suppressions:z.array(z.string().min(1).max(100)).max(100),reset:z.boolean()}).parse(body));
  const edition=path.match(/^\/editions\/(.+)$/);if(edition&&method==='GET'){const value=this.store.read(`published:${decodeURIComponent(edition[1])}`);if(!value)throw new AppError(404,'missing_edition','Edition not found.');return value;}
  const article=path.match(/^\/articles\/([^/]+)\/(task-drafts|notion)$/);
  if(article&&method==='POST'){
   if(article[2]==='task-drafts'){const input=z.object({instruction:z.string().trim().min(1).max(4000)}).parse(body);return this.tasks.planTasks({articleId:article[1],instruction:input.instruction});}
   if(!this.notion)throw new AppError(422,'notion_setup','Connect Notion first.');return this.notion.saveArticleToNotion(article[1]);
  }
  const draft=path.match(/^\/task-drafts\/([^/]+)(\/confirm)?$/);
  if(draft&&!draft[2]&&method==='GET')return this.tasks.readDraft(draft[1]);
  if(draft?.[2]&&method==='POST'){const input=z.object({expectedVersion:z.number().int().positive()}).parse(body);return this.tasks.confirmDraft(draft[1],input.expectedVersion);}
  if(draft&&!draft[2]&&method==='PUT'){const input=z.object({expectedVersion:z.number().int().positive(),tasks:z.array(DraftTaskSchema).min(1).max(12)}).parse(body);return this.tasks.editDraft(draft[1],input.expectedVersion,input.tasks);}
  throw new AppError(404,'not_found','This operation is not available.');
 }
}
