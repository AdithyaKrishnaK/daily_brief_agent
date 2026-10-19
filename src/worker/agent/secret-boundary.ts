// Detect accidental legacy/development bindings without reading or logging values.
export function assertNoProviderSecrets(env:object):void {
 for(const key of ['OPENROUTER_API_KEY','TODOIST_TOKEN','NOTION_TOKEN']){
  if(key in env)throw new Error('Provider secrets must be configured only on the credentials Worker.');
 }
}
