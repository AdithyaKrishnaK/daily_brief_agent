import {expect,it} from 'vitest';
import {rpcResult} from '../../src/worker/http';
import {AppError,SettingsSchema} from '../../src/shared/contracts';
it('preserves stale confirmation and validation status across a serialized RPC boundary',async()=>{
 const stale=JSON.parse(JSON.stringify(await rpcResult(async()=>{throw new AppError(409,'stale_draft','Review the latest preview.');})));
 expect(stale.status).toBe(409);expect(stale.body.error.code).toBe('stale_draft');
 const invalid=await rpcResult(async()=>SettingsSchema.parse({}));expect(invalid.status).toBe(400);
});
