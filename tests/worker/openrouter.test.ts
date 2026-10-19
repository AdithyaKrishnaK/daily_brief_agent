import { afterEach, expect, it, vi } from 'vitest';
import { createBriefModels, createGatewayModels, briefModel } from '../../src/worker/agent/openrouter';
import { Harness, MemoryStorage, createRegistry, AssistantEntry } from '@earendil-works/pi-durable';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
afterEach(() => vi.unstubAllGlobals());

it.each(['direct','gateway'])('sends the requested DeepSeek model through %s with the real Pi SDK', async mode => {
 let requestUrl = ''; let requestBody: any; let authorization = '';
 vi.stubGlobal('fetch', async (input: RequestInfo | URL, options?: RequestInit) => {
  const request = new Request(input, options);
  requestUrl = request.url; requestBody = await request.json(); authorization = request.headers.get('authorization') ?? '';
  return new Response('data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:'deepseek/deepseek-v4.1-flash-1017',choices:[{index:0,delta:{role:'assistant',content:'{"overview":"Verified","groups":[]}'},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:'deepseek/deepseek-v4.1-flash-1017',choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n', {headers:{'content-type':'text/event-stream'}});
 });
 const {modelCompletion}=await import('../../src/worker/integrations/credentials');
 const upstream=globalThis.fetch;
 const models = mode==='direct'?createBriefModels('test-server-key'):createGatewayModels({complete:async input=>modelCompletion(input,'test-server-key',upstream)});
 if(mode==='gateway')vi.stubGlobal('fetch',()=>{throw new Error('Pi attempted direct network access');});
 const context = BACKGROUND_CONTEXT;
 const harness = await Harness.open(new MemoryStorage(), { models, registry: createRegistry() }, context);
 try {
  const conversation = await harness.root(context, {agent:{model:briefModel,thinkingLevel:'low',tools:[]}});
  const submission = await conversation.submit({type:'input',content:'Return a brief',requestId:'test-brief'},context);
  const settled = await submission.wait(context);
  expect(settled.status,JSON.stringify(settled)).toBe('done');
  if(settled.status!=='done'||settled.type!=='input')throw new Error('No completed model answer');
  const entry = await conversation.commit(tx=>tx.entry(AssistantEntry,settled.answer),context);
  expect(entry?.model?.[0]?.content).toContainEqual({type:'text',text:'{"overview":"Verified","groups":[]}'});
 } finally {await harness.close(context);}
 expect(requestUrl).toBe('https://openrouter.ai/api/v1/chat/completions');
 expect(requestBody.model).toBe('deepseek/deepseek-v4.1-flash-1017');
 expect(authorization).toBe('Bearer test-server-key');
});
it('requires OpenRouter credentials instead of falling back to another provider', () => {
 expect(() => createBriefModels('')).toThrow('OPENROUTER_API_KEY');
});
