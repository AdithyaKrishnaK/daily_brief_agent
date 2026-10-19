import { expect, it } from 'vitest';
import { scheduledEdition, localDate } from '../../src/worker/briefs/schedule';
import { BriefRuns, validateBrief } from '../../src/worker/briefs/runs';
import { defaultSettings } from '../../src/shared/contracts';
import { BriefStore } from '../../src/worker/store';
import { database } from '../helpers';
it('starts at 05:30 IST, keys by local date, and follows configurable zones', () => {
  expect(scheduledEdition(defaultSettings,new Date('2026-10-17T23:59:00Z'))).toBeNull();
  expect(scheduledEdition(defaultSettings,new Date('2026-10-18T00:00:00Z'))?.localDate).toBe('2026-10-18');
  expect(scheduledEdition(defaultSettings,new Date('2026-10-18T00:30:00Z'))?.editionId).toBe('owner:2026-10-18');
  expect(localDate('Asia/Kolkata',new Date('2026-10-17T20:00:00Z'))).toBe('2026-10-18');
  expect(scheduledEdition({...defaultSettings,timeZone:'America/New_York'},new Date('2026-11-01T10:30:00Z'))?.localDate).toBe('2026-11-01');
});
it('resumes duplicate runs and retains published revisions while refreshing', () => {
  const store = new BriefStore(database()); const runs = new BriefRuns(store); const now=new Date('2026-10-18T00:00:00Z');
  const first=runs.start('owner:2026-10-18',false,now);
  expect(runs.start(first.id,false,now).revision).toBe(1);
  runs.publish(first.id,{overview:'An evidence-based brief',groups:[]},[{sourceId:'hn',ok:true,count:0}],now);
  const refresh=runs.start(first.id,true,now); expect(refresh.revision).toBe(2);
  expect(store.read<any>(`published:${first.id}`)?.overview).toBe('An evidence-based brief');
  runs.fail(first.id,'Model unavailable',now);
  expect(store.read<any>(`published:${first.id}`)?.overview).toBe('An evidence-based brief');
});
it('rejects unsupported citations, repeated group IDs and excessive headlines', () => {
  const group={id:'one',headline:'News',summary:'Evidence',keyDetails:[],topics:[],evidenceArticleIds:['missing']};
  expect(()=>validateBrief({overview:'Today',groups:[group]},[])).toThrow();
  expect(()=>validateBrief({overview:'Today',groups:Array(11).fill(group)},['missing'])).toThrow();
  expect(()=>validateBrief({overview:'Today',groups:[group,group]},['missing'])).toThrow();
});
