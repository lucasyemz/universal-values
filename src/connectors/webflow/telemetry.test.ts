import {expect,it,vi} from 'vitest';
import {providerRequest} from './telemetry';
it('logs only safe classifications, status/429 and duration without changing response',async()=>{
 const sink=vi.fn(),response=new Response('',{status:429,headers:{'Retry-After':'120'}}),fetcher=vi.fn().mockResolvedValue(response);
 expect(await providerRequest(fetcher,'/collections/secret/items?token=secret',{method:'GET',headers:{Authorization:'Bearer secret'}},{action:'cms_live',siteId:'not-an-id'},sink)).toBe(response);
 expect(sink).toHaveBeenCalledWith({provider:'webflow',action:'cms_live',endpoint:'items',operation:'read',status:429,rateLimited:true,durationMs:expect.any(Number)});
 expect(JSON.stringify(sink.mock.calls)).not.toContain('secret');
});
it('does not let a telemetry error retry or change a write',async()=>{
 const fetcher=vi.fn().mockRejectedValue(new Error('network'));
 await expect(providerRequest(fetcher,'/collections/a/items/b',{method:'PATCH'},undefined,()=>{throw new Error('sink');})).rejects.toThrow('network');expect(fetcher).toHaveBeenCalledTimes(1);
});
