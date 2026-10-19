import {expect,it} from 'vitest';
import {assertNoProviderSecrets} from '../../src/worker/agent/secret-boundary';
it('fails closed when provider secrets are accidentally bound outside the credential Worker',()=>{
 expect(()=>assertNoProviderSecrets({MODEL_GATEWAY:{}})).not.toThrow();
 for(const name of ['OPENROUTER_API_KEY','TODOIST_TOKEN','NOTION_TOKEN']){
  let error:unknown;try{assertNoProviderSecrets({[name]:'do-not-disclose'});}catch(value){error=value;}
  expect(error).toBeInstanceOf(Error);expect(String(error)).not.toContain('do-not-disclose');
 }
});
