import { AppError, type Article } from '../../shared/contracts';
import { BriefStore } from '../store';
import { Actions, ProviderError, type ProviderWriteResult } from './actions';
import { Preferences } from '../preferences/profile';
const rich=(value:string)=>[{type:'text',text:{content:value.slice(0,1900)}}];
export class NotionAdapter {
 private sourceId:string|undefined;
 constructor(private token:string,readonly databaseId:string,private http:typeof fetch=fetch,private configuredDataSource?:string){}
 private async request(path:string,body?:unknown){
  if(!this.token||!this.databaseId)throw new ProviderError('Connect Notion and share a database first.',true);
  const response=await this.http(`https://api.notion.com/v1/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${this.token}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw new ProviderError(`Notion returned ${response.status}. Check database sharing and schema.`,response.status>=400&&response.status<500&&response.status!==409);
  return await response.json() as any;
 }
 async validateDestination(){
  if(this.sourceId)return {name:'Notion',configured:true,detail:'Database connected'};
  const database=await this.request(`databases/${encodeURIComponent(this.databaseId)}`);
  const candidates=database.data_sources??[];const id=this.configuredDataSource??(candidates.length===1?candidates[0].id:undefined);
  if(!id||!candidates.some((d:any)=>d.id===id))throw new ProviderError('Select a data source in this Notion database.',true);
  const source=await this.request(`data_sources/${encodeURIComponent(id)}`);
  const expected={Name:'title',URL:'url',Summary:'rich_text',Source:'rich_text',Published:'date',Saved:'date',Topics:'multi_select'};
  for(const [name,type] of Object.entries(expected))if(source.properties?.[name]?.type!==type)throw new ProviderError(`Notion needs a ${name} property of type ${type}.`,true);
  this.sourceId=id;return {name:'Notion',configured:true,detail:'Database connected'};
 }
 async find(url:string):Promise<ProviderWriteResult|null>{await this.validateDestination();const data=await this.request(`data_sources/${this.sourceId}/query`,{filter:{property:'URL',url:{equals:url}},page_size:2});const page=data.results?.[0];return page?{externalId:page.id,url:page.url}:null;}
 async create(article:Article,summary:string){await this.validateDestination();return await this.request('pages',{parent:{type:'data_source_id',data_source_id:this.sourceId},properties:{Name:{title:rich(article.title)},URL:{url:article.url},Summary:{rich_text:rich(summary)},Source:{rich_text:rich(article.sources.join(', '))},Published:{date:article.publishedAt?{start:article.publishedAt}:null},Saved:{date:{start:new Date().toISOString()}},Topics:{multi_select:article.topics.slice(0,8).map(name=>({name:name.slice(0,100)}))}},children:[{object:'block',type:'paragraph',paragraph:{rich_text:rich(summary)}},{object:'block',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content:'Read original article',link:{url:article.url}}}]}}]}).then(page=>({externalId:page.id,url:page.url}));}
}
export class NotionSaves {
 private actions:Actions;
 constructor(private store:BriefStore,private adapter:Pick<NotionAdapter,'databaseId'|'find'|'create'>){this.actions=new Actions(store);}
 async saveArticleToNotion(articleId:string){
  const article=this.store.article(articleId);if(!article)throw new AppError(404,'missing_article','Article not found.');
  const group=this.store.editions().flatMap(e=>e.groups).find(g=>g.evidenceArticleIds.includes(articleId));
  const summary=group?.summary??'Saved for reading. A generated summary is not available.';const key=`notion:${this.adapter.databaseId}:${article.id}`;
  const receipt=await this.actions.deliver(key,'notion',article.url,async()=>{const existing=await this.adapter.find(article.url);return existing??await this.adapter.create(article,summary);},()=>this.adapter.find(article.url));
  if(receipt.status==='succeeded')new Preferences(this.store).recordFeedback({id:key,kind:'save',targetId:article.id,topics:article.topics,at:new Date().toISOString()});return receipt;
 }
}
