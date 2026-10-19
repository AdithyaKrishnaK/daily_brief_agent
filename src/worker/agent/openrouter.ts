import { createModels } from '@earendil-works/pi-ai/models';
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter';
import type { Model, ApiStreamOptions } from '@earendil-works/pi-ai';

export const briefModel = { provider: 'openrouter', modelId: 'deepseek/deepseek-v4.1-flash-1017' } as const;

export function createBriefModels(apiKey: string) {
  if (!apiKey.trim()) throw new Error('Set OPENROUTER_API_KEY in .env or server secrets.');
  const models = createModels({ authContext: {
    env: async name => name === 'OPENROUTER_API_KEY' ? apiKey : undefined,
    fileExists: async () => false
  } });
  const provider = openrouterProvider();
  // This snapshot postdates Pi 1.0.2's bundled catalog. Register the exact
  // OpenRouter ID explicitly; 16K is our output cap, not the model's limit.
  // Metadata: https://openrouter.ai/deepseek/deepseek-v4.1-flash-1017
  const model: Model<'openai-completions'> = {
    id: briefModel.modelId, name: 'DeepSeek V4.1 Flash 1017', provider: briefModel.provider,
    api: 'openai-completions', baseUrl: 'https://openrouter.ai/api/v1',
    reasoning: true, input: ['text', 'image'], contextWindow: 1048576, maxTokens: 16384,
    cost: { input: 0.05, output: 0.60, cacheRead: 0.008, cacheWrite: 0 },
    compat: { supportsDeveloperRole: false, thinkingFormat: 'openrouter', supportsStrictMode: true },
  };
  models.setProvider({ ...provider, getModels: () => [model], getAllModels: () => [model] });
  return models;
}

export interface ModelGatewayPort {complete(input:unknown):Promise<Response>}
export function createGatewayModels(gateway:ModelGatewayPort){
  // SDK auth requires a value; this public placeholder is not a credential and
  // is discarded by the transport. Only the gateway supplies real auth.
  const models=createBriefModels('private-service-binding');
  const provider=models.getProvider(briefModel.provider)!;
  const transport:typeof fetch=async(input,init)=>{
    const request=new Request(input,init);
    if(request.url!=='https://openrouter.ai/api/v1/chat/completions'||request.method!=='POST')throw new Error('Unsupported model operation.');
    return gateway.complete(await request.json());
  };
  models.setProvider({...provider,
    stream:(model,context,options)=>provider.stream(model,context,{...options,fetch:transport} as ApiStreamOptions<typeof model.api>),
    streamSimple:(model,context,options)=>provider.streamSimple(model,context,{...options,fetch:transport})
  });
  return models;
}
