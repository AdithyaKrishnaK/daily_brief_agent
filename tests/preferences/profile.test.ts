import { expect,it } from 'vitest';
import { Preferences } from '../../src/worker/preferences/profile';
import { BriefStore } from '../../src/worker/store';
import { database } from '../helpers';
it('uses reversible explicit evidence while keeping task actions separate from topics',()=>{
 const store=new BriefStore(database());const prefs=new Preferences(store);
 const event={id:'e1',kind:'more' as const,targetId:'a',topics:['agents'],at:'2026-10-18'};
 const profile=prefs.recordFeedback(event);expect(profile.weights.agents).toBeGreaterThan(0);
 prefs.recordFeedback({...event,id:'task',kind:'task',topics:['finance']});expect(prefs.profile().weights.finance??0).toBe(0);
 prefs.removeEvidence('e1');expect(prefs.profile().weights.agents??0).toBe(0);
 expect(store.read<any>('profile:1').weights.agents).toBeGreaterThan(0);
 prefs.updateInterests({follows:['research'],suppressions:[],reset:false});expect(prefs.profile().follows).toEqual(['research']);
 prefs.updateInterests({follows:[],suppressions:[],reset:true});expect(prefs.profile().weights).toEqual({});
});
it('keeps two discovery slots and broad ranking for a new user',()=>{
 const prefs=new Preferences(new BriefStore(database()));prefs.updateInterests({follows:['agents'],suppressions:[],reset:false});
 const articles=Array.from({length:12},(_,i)=>({id:String(i),title:`Story ${i}`,url:`https://example.com/${i}`,sources:[],topics:[i<10?'agents':'science'],content:'',contentStatus:'title-only' as const}));
 expect(prefs.rankArticles(articles).slice(0,10).filter(a=>a.topics.includes('science'))).toHaveLength(2);
});
