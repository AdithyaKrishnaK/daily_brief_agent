import { AppError, type ActionReceipt } from '../../shared/contracts';
import { BriefStore } from '../store';
export interface ProviderWriteResult { externalId: string; url?: string }
export class ProviderError extends Error { constructor(message: string,public safeToRetry: boolean){super(message);} }
export class Actions {
 private active=new Set<string>();
 constructor(private store: BriefStore){}
 async deliver(key:string,provider:ActionReceipt['provider'],fingerprint:string,write:()=>Promise<ProviderWriteResult>,reconcile:()=>Promise<ProviderWriteResult|null>):Promise<ActionReceipt>{
  let receipt=this.store.read<ActionReceipt>(`action:${key}`);
  if(receipt && receipt.fingerprint!==fingerprint)throw new AppError(409,'action_changed','This action has changed. Review it again.');
  if(receipt?.status==='succeeded'||this.active.has(key))return receipt!;
  this.active.add(key);
  try{
   if(receipt && ['inflight','uncertain'].includes(receipt.status)){
    try{const found=await reconcile();receipt={...receipt,...found,status:found?'succeeded':'uncertain',error:found?undefined:'Check the destination before resolving this action.'};}catch{receipt={...receipt,status:'uncertain',error:'Could not verify the destination. No duplicate was sent.'};}
    this.store.write(`action:${key}`,receipt);return receipt;
   }
   receipt={key,provider,fingerprint,status:'pending'};this.store.write(`action:${key}`,receipt);
   receipt.status='inflight';this.store.write(`action:${key}`,receipt);
   try{const result=await write();if(!result.externalId)throw new Error('Missing destination receipt');receipt={...receipt,...result,status:'succeeded'};}
   catch(error){receipt={...receipt,status:error instanceof ProviderError&&error.safeToRetry?'failed':'uncertain',error:error instanceof ProviderError?error.message:'The response was lost. Check the destination before retrying.'};}
   this.store.write(`action:${key}`,receipt);return receipt;
  }finally{this.active.delete(key);}
 }
}
