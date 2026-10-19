import type {Edition} from '../../shared/contracts';
import {BriefStore} from '../store';
type Claim={attempt:number;token:string;leaseUntil:number};
type Admission={status:'admitted';attempt:number;token:string}|{status:'busy'|'stale'|'exhausted'};
export class RunAdmission {
 constructor(private store:BriefStore){}
 admit(id:string,revision:number,now:number):Admission{
  const edition=this.store.read<Edition>(`edition:${id}`);if(!edition||edition.revision!==revision||edition.status!=='running')return {status:'stale'};
  const key=`admission:${id}:${revision}`;const previous=this.store.read<Claim>(key);
  if(previous&&previous.leaseUntil>now)return {status:'busy'};
  if((previous?.attempt??0)>=3)return {status:'exhausted'};
  const claim={attempt:(previous?.attempt??0)+1,token:crypto.randomUUID(),leaseUntil:now+15*60000};this.store.write(key,claim);return {status:'admitted',attempt:claim.attempt,token:claim.token};
 }
 release(id:string,revision:number,token:string,notBefore=0){const key=`admission:${id}:${revision}`;const claim=this.store.read<Claim>(key);if(claim?.token!==token)return false;this.store.write(key,{...claim,leaseUntil:notBefore});return true;}
}
