import {ZodError} from 'zod';
import {AppError} from '../shared/contracts';
export interface RpcResult {status:number;body:{data?:unknown;error?:{code:string;message:string}}}
export async function readJsonBody(request:Request):Promise<unknown>{
 if(['GET','HEAD','DELETE'].includes(request.method))return undefined;
 if(Number(request.headers.get('Content-Length'))>65536)throw new AppError(413,'large_request','Request is too large.');
 const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
 if(reader){try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>65536)throw new AppError(413,'large_request','Request is too large.');chunks.push(next.value);}}finally{await reader.cancel();}}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const text=new TextDecoder().decode(bytes);if(!text)return undefined;
 try{return JSON.parse(text);}catch{throw new AppError(400,'invalid_json','Request must contain valid JSON.');}
}
export async function rpcResult(operation:()=>Promise<unknown>):Promise<RpcResult>{
 try{return {status:200,body:{data:await operation()}};}catch(error){
  if(error instanceof AppError)return {status:error.status,body:{error:{code:error.code,message:error.message}}};
  if(error instanceof ZodError)return {status:400,body:{error:{code:'invalid_input',message:'Check the submitted fields.'}}};
  return {status:500,body:{error:{code:'service_error',message:'The request could not be completed. Check service connections and try again.'}}};
 }
}
