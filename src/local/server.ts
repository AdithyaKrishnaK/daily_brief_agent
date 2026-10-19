import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import type { Application } from '../worker/application';
import { AppError } from '../shared/contracts';
import { assertMutationOrigin } from '../worker/auth';
import { readJsonBody, rpcResult } from '../worker/http';

export function createLocalHandler(application:Application,assets:string,origin:string){
 const host=new URL(origin).host;const directory=resolve(assets);
 return async (request:Request):Promise<Response>=>{
  try{
   const url=new URL(request.url);
   if(request.headers.get('host')!==host||url.origin!==origin)throw new AppError(403,'invalid_host','Use the local app address printed in your terminal.');
   assertMutationOrigin(request,origin);
   if(url.pathname.startsWith('/api/')){
    const result=await rpcResult(async()=>application.handle(url.pathname.slice(4),request.method,await readJsonBody(request)));
    return Response.json(result.body,{status:result.status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   }
   if(!['GET','HEAD'].includes(request.method))throw new AppError(405,'method_not_allowed','Method not allowed.');
   const path=decodeURIComponent(url.pathname);
   if(path!=='/'&&path!=='/index.html'&&!path.startsWith('/assets/'))throw new AppError(404,'not_found','Page not found.');
   const file=resolve(directory,path==='/'?'index.html':path.slice(1));
   if(relative(directory,file).startsWith('..'))throw new AppError(404,'not_found','Page not found.');
   let body:Buffer;try{body=await readFile(file);}catch{throw new AppError(404,'not_found','Build the dashboard before starting the local app.');}
   const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
   return new Response(request.method==='HEAD'?null:new Uint8Array(body),{headers:{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){const result=await rpcResult(async()=>{throw error;});return Response.json(result.body,{status:result.status});}
 };
}

export async function startLocalServer(application:Application,assets:string,port=4180){
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('BRIEF_PORT must be a port between 1024 and 65535.');
 const origin=`http://127.0.0.1:${port}`;const handle=createLocalHandler(application,assets,origin);
 const server=createServer(async (incoming,outgoing)=>{
  try{
   const headers=new Headers();for(const [key,value] of Object.entries(incoming.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
   const method=incoming.method??'GET';
   const options:RequestInit & {duplex?:'half'}={method,headers};
   if(!['GET','HEAD'].includes(method)){options.body=Readable.toWeb(incoming) as ReadableStream<Uint8Array>;options.duplex='half';}
   const response=await handle(new Request(new URL(incoming.url??'/',origin),options));
   outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
  }catch{outgoing.writeHead(500,{'Content-Type':'application/json'});outgoing.end(JSON.stringify({error:{message:'The local app could not handle this request.'}}));}
 });
 await new Promise<void>((ready,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);ready();});});
 return {origin,server};
}
