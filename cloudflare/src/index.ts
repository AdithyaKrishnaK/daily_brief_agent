import {assertNoProviderSecrets} from '../../src/worker/agent/secret-boundary';
import { ZodError } from 'zod';
import { authenticate,assertMutationOrigin } from '../../src/worker/auth';
import { AppError } from '../../src/shared/contracts';
import type { Env } from './env';
import { readJsonBody } from '../../src/worker/http';
export { BriefAgent } from './brief-agent';
function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  try{
   assertNoProviderSecrets(env);await authenticate(request,env);assertMutationOrigin(request,env.APP_ORIGIN);
   const url=new URL(request.url);
   if(url.pathname.startsWith('/api/')){
    const body=await readJsonBody(request);
    const result=await env.AGENT.getByName('owner').handleApi(url.pathname.slice(4),request.method,body);return json(result.body,result.status);
   }
   const response=await env.ASSETS.fetch(request);const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('Cache-Control','private, no-store');return new Response(response.body,{status:response.status,headers});
  }catch(error){if(error instanceof AppError)return json({error:{code:error.code,message:error.message}},error.status);if(error instanceof ZodError)return json({error:{code:'invalid_input',message:'Check the submitted fields.'}},400);return json({error:{code:'service_error',message:'The request could not be completed. Check service connections and try again.'}},500);}
 },
 async scheduled(controller:ScheduledController,env:Env){assertNoProviderSecrets(env);await env.AGENT.getByName('owner').dispatchScheduled(controller.scheduledTime);}
};
