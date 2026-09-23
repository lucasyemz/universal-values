import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/modules/auth/service',()=>({requireUser:async()=>({client:{rpc}})}));
import {kickConfirmedOperation} from './kick';
it('acceleration failure cannot reject a confirmed operation or retry automatically',async()=>{
 rpc.mockRejectedValueOnce(new Error('offline'));await expect(kickConfirmedOperation('id')).resolves.toBeUndefined();
 expect(rpc).toHaveBeenCalledExactlyOnceWith('request_cms_worker_kick',{p_id:'id'});
});
