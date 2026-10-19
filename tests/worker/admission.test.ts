import {expect,it} from 'vitest';
import {RunAdmission} from '../../src/worker/briefs/admission';
import {BriefRuns} from '../../src/worker/briefs/runs';
import {BriefStore} from '../../src/worker/store';
import {database} from '../helpers';
it('does not consume retry attempts for duplicate callbacks or old revisions',()=>{
 const store=new BriefStore(database());new BriefRuns(store).start('owner:2026-10-18',false,new Date());const gate=new RunAdmission(store);
 const first=gate.admit('owner:2026-10-18',1,0);expect(first.status).toBe('admitted');
 expect(gate.admit('owner:2026-10-18',1,100).status).toBe('busy');
 if(first.status!=='admitted')throw new Error('missing claim');
 gate.release('owner:2026-10-18',1,first.token,1000);
 expect(gate.admit('owner:2026-10-18',1,500).status).toBe('busy');
 const second=gate.admit('owner:2026-10-18',1,1001);expect(second.status==='admitted'&&second.attempt).toBe(2);
 expect(gate.admit('owner:2026-10-18',99,1001).status).toBe('stale');
});
