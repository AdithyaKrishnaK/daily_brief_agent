import type { Article,Edition } from '../../shared/contracts';
import { BriefStore } from '../store';
import { BriefModel } from '../agent/model';
import { BriefRuns } from './runs';
import { collectSources,type CollectionResult,type PendingArticle } from '../sources/collect';
import { Preferences } from '../preferences/profile';
export class BriefEngine {
 private runs:BriefRuns; private active=new Set<string>();
 constructor(private store:BriefStore,private model:BriefModel,private collect:typeof collectSources=collectSources){this.runs=new BriefRuns(store);}
 start(id:string,refresh:boolean,now:Date){return this.runs.start(id,refresh,now);}
 async run(id:string,refresh:boolean,now:Date){
  if(this.active.has(id))return;
  this.active.add(id);
  try{
   const edition=this.runs.start(id,refresh,now);if(['ready','partial'].includes(edition.status))return edition;
   const stageKey=`collection:${id}:${edition.revision}`;
   let collection=this.store.read<CollectionResult>(stageKey);
   if(!collection){collection=await this.collect(this.store.getSettings(),this.store.read<Record<string,string>>('checkpoints')??{},now,undefined,this.store.read<PendingArticle[]>('pending-articles')??[]);this.store.write(stageKey,collection);for(const article of collection.articles)this.store.saveArticle(article);}
   const preferences=new Preferences(this.store);const profile=this.store.read<any>(`profile:${edition.profileVersion}`)??this.store.getProfile();
   const fingerprint=(article:Article)=>JSON.stringify([article.title,article.contentStatus,article.content]);
   const eligible=collection.articles.map(a=>this.store.article(a.id)??a).filter(a=>{const previous=this.store.read<{date:string;fingerprint:string}>(`published-article:${a.id}`);return !previous||previous.date===edition.localDate||previous.fingerprint!==fingerprint(a);});
   const articles=preferences.rankArticles(eligible,profile);
   const previous=this.store.list<Edition>('published:').sort((a,b)=>b.localDate.localeCompare(a.localDate))[0]??null;
   const attemptKey=`model-attempt:${id}:${edition.revision}`;const attempt=this.store.read<number>(attemptKey)??0;
   let content;
   try{content=await this.model.generateBrief(articles,profile,previous,`brief:${id}:${edition.revision}:${attempt}`);}catch(error){this.store.write(attemptKey,attempt+1);throw error;}
   for(const group of content.groups)for(const articleId of group.evidenceArticleIds){const article=this.store.article(articleId);if(article){this.store.saveArticle({...article,topics:[...new Set([...article.topics,...group.topics])]});this.store.write(`published-article:${article.id}`,{date:edition.localDate,fingerprint:fingerprint(article)});}}
   const published=this.runs.publish(id,content,collection.outcomes,new Date());this.store.write('checkpoints',collection.checkpoints);this.store.write('pending-articles',collection.pending??[]);return published;
  }finally{this.active.delete(id);}
 }
 fail(id:string,message:string){this.runs.fail(id,message,new Date());}
}
