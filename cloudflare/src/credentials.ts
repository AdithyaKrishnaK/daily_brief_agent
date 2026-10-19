import {WorkerEntrypoint} from 'cloudflare:workers';
import {IntegrationService,modelCompletion,type CredentialEnv} from '../../src/worker/integrations/credentials';

// Named entrypoints deliberately have different capabilities. Only the trusted
// application binds IntegrationWrites; Pi only binds ModelGateway.
export class IntegrationWrites extends WorkerEntrypoint<CredentialEnv>{
 destination(){return {databaseId:this.env.NOTION_DATABASE_ID??''};}
 createTodoistTask(input:unknown){return new IntegrationService(this.env).createTodoistTask(input);}
 saveArticle(input:unknown){return new IntegrationService(this.env).saveArticle(input);}
 findSavedArticle(input:unknown){return new IntegrationService(this.env).findSavedArticle(input);}
 connections(){return new IntegrationService(this.env).connections();}
}
export class ModelGateway extends WorkerEntrypoint<CredentialEnv>{
 complete(input:unknown){return modelCompletion(input,this.env.OPENROUTER_API_KEY);}
}
export default {fetch(){return new Response('Not found',{status:404});}};
