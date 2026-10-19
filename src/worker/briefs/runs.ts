import { BriefSchema, AppError, type Edition, type SourceOutcome, type BriefContent } from '../../shared/contracts';
import { BriefStore } from '../store';
export function validateBrief(value: unknown, evidenceIds: string[]): BriefContent {
  const brief=BriefSchema.parse(value); const ids=new Set(evidenceIds); const groups=new Set<string>();
  for(const group of brief.groups){ if(groups.has(group.id)||group.evidenceArticleIds.some(id=>!ids.has(id))) throw new AppError(422,'invalid_brief','The brief contains unsupported evidence.'); groups.add(group.id); }
  return brief;
}
export class BriefRuns {
  constructor(private store: BriefStore){}
  start(id: string, refresh: boolean, now: Date): Edition {
    const existing=this.store.read<Edition>(`edition:${id}`);
    if(existing && (existing.status==='running'||!refresh)) return existing;
    const profile=this.store.getProfile();this.store.write(`profile:${profile.version}`,profile);
    const edition: Edition={ id,localDate:id.split(':').at(-1)!,revision:(existing?.revision??0)+1,status:'running',profileVersion:profile.version,overview:'',groups:[],sourceOutcomes:[],startedAt:now.toISOString(),updatedAt:now.toISOString() };
    this.store.write(`edition:${id}`,edition); return edition;
  }
  publish(id: string, content: BriefContent, outcomes: SourceOutcome[], now: Date) {
    const edition=this.store.read<Edition>(`edition:${id}`)!;
    const result={...edition,...content,sourceOutcomes:outcomes,status:outcomes.some(o=>!o.ok)?'partial':'ready',updatedAt:now.toISOString()} as Edition;
    this.store.write(`edition:${id}`,result); this.store.write(`published:${id}`,result); this.store.write(`history:${id}:${edition.revision}`,result); return result;
  }
  fail(id: string,error: string,now: Date) { const edition=this.store.read<Edition>(`edition:${id}`)!; this.store.write(`edition:${id}`,{...edition,status:'failed',error,updatedAt:now.toISOString()}); }
}
