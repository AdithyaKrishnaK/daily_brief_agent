import {assertNoProviderSecrets} from '../../src/worker/agent/secret-boundary';
import {WorkerEntrypoint} from 'cloudflare:workers';
import {Agent} from 'agents';
import {createRegistry,Harness} from '@earendil-works/pi-durable';
import {PiHarness} from 'agents/harness/pi';
import {createGatewayModels,briefModel} from '../../src/worker/agent/openrouter';
import {BriefStore} from '../../src/worker/store';
import type {ModelGateway} from './credentials';

interface PiEnv {
 PI_SESSIONS:DurableObjectNamespace<PiAgent>;
 MODEL_GATEWAY:Service<ModelGateway>;
}
export class PiAgent extends Agent<PiEnv>{
 #store:BriefStore;
 #registry=createRegistry();
 #harness=new PiHarness({
  harness:({storage,context})=>Harness.open(storage,{models:createGatewayModels(this.env.MODEL_GATEWAY),registry:this.#registry,settings:{retry:{enabled:true,maxRetries:2,baseDelayMs:500}}},context),
  defaults:{model:briefModel,thinkingLevel:'low'}
 });
 constructor(ctx:DurableObjectState,env:PiEnv){super(ctx,env);assertNoProviderSecrets(env);this.lifecycle.use(this.#harness);this.#store=new BriefStore(ctx.storage);}
 async json(prompt:string,key:string):Promise<unknown>{
  if(typeof prompt!=='string'||prompt.length>110000||typeof key!=='string'||key.length>500)throw new Error('Invalid model operation.');
  key=`${briefModel.modelId}:${key}`;
  const cached=this.#store.read<unknown>(`model-result:${key}`);if(cached!==null)return cached;
  let sessionId=this.#store.read<string>(`model-session:${key}`);
  if(!sessionId){const session=await this.#harness.sessions.create();sessionId=session.id;this.#store.write(`model-session:${key}`,sessionId);}
  const session=this.#harness.session(sessionId);
  await session.submit(prompt,{operationId:key});
  let result;
  try{result=await session.wait(key,AbortSignal.timeout(10*60000));}catch{await session.abort(key);throw new Error('Model operation failed.');}
  if(result.status!=='done'||!result.text)throw new Error('The model did not produce a complete answer.');
  const text=result.text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const value=JSON.parse(text);this.#store.write(`model-result:${key}`,value);return value;
 }
}
export class PiService extends WorkerEntrypoint<PiEnv>{
 json(prompt:string,key:string){return this.env.PI_SESSIONS.getByName('owner').json(prompt,key);}
}
export default {fetch(){return new Response('Not found',{status:404});}};
