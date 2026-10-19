import { FeedbackSchema, type FeedbackEvent, type Article, type InterestProfile } from '../../shared/contracts';
import { BriefStore, emptyProfile } from '../store';
export class Preferences {
 constructor(private store: BriefStore){}
 profile(){return this.store.getProfile();}
 private save(profile: InterestProfile){this.store.write('profile',profile);this.store.write(`profile:${profile.version}`,profile);return profile;}
 private derive(evidence: FeedbackEvent[],follows: string[],suppressions: string[]){
  const weights: Record<string,number>={};const taskStyle:string[]=[];
  for(const e of evidence){const weight={more:3,less:-3,known:-1,follow:5,save:1,task:0,'task-edit':0,click:0.1}[e.kind];for(const topic of e.topics)weights[topic]=(weights[topic]??0)+weight;if(e.kind==='task-edit'&&e.payload)taskStyle.push(e.payload);}
  for(const t of follows)weights[t]=(weights[t]??0)+10;for(const t of suppressions)weights[t]=-100;
  return this.save({version:this.profile().version+1,weights,follows,suppressions,evidence,taskStyle:taskStyle.slice(-12)});
 }
 recordFeedback(input: FeedbackEvent){const event=FeedbackSchema.parse(input);const p=this.profile();if(p.evidence.some(e=>e.id===event.id))return p;return this.derive([...p.evidence,event],p.follows,p.suppressions);}
 removeEvidence(id: string){const p=this.profile();return this.derive(p.evidence.filter(e=>e.id!==id),p.follows,p.suppressions);}
 updateInterests(input:{follows:string[];suppressions:string[];reset:boolean}){const p=this.profile();return this.derive(input.reset?emptyProfile().evidence:p.evidence,input.reset?[]:input.follows,input.reset?[]:input.suppressions);}
 rankArticles(articles: Article[],p:InterestProfile=this.profile()){
  const score=(a:Article)=>a.topics.reduce((sum,t)=>sum+(p.weights[t]??0),0);
  const eligible=articles.filter(a=>!a.topics.some(t=>p.suppressions.includes(t)));
  const ordered=[...eligible].sort((a,b)=>score(b)-score(a)||(b.publishedAt??'').localeCompare(a.publishedAt??'')||a.id.localeCompare(b.id));
  if(!Object.values(p.weights).some(w=>w>0))return ordered;
  const discovery=ordered.filter(a=>score(a)<=0).slice(0,2);const rest=ordered.filter(a=>!discovery.includes(a));return [...rest.slice(0,8),...discovery,...rest.slice(8)];
 }
}
