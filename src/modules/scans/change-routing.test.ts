vi.mock("server-only",()=>({}));
import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),owner:vi.fn(),site:vi.fn(),from:vi.fn(),select:vi.fn()}));
vi.mock('@/modules/auth/service',()=>({requireUser:m.auth}));
vi.mock('@/modules/sites/service',()=>({requireWorkspaceOwner:m.owner}));
vi.mock('./service',()=>({getScanSite:m.site}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('not found');}}));
import {loadChangeRouting} from './change-routing';
import {id,other} from './inline-preview.fixture';
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({user:{id},client:{from:m.from}});m.select.mockImplementation(()=>({eq:()=>({maybeSingle:async()=>({data:{id,actor_id:id,workspace_id:id,site_id:id,scan_id:other},error:null})})}));m.from.mockImplementation(()=>({select:m.select}));m.site.mockResolvedValue({workspace_id:id});});
it('routes scan edits and reversals from identities without snapshots or a planner',async()=>{
 expect((await loadChangeRouting(id)).scan_id).toBe(other);
 expect(m.select.mock.calls.map(c=>c[0])).toEqual(['id,actor_id,workspace_id,site_id,scan_id','id,actor_id,workspace_id,site_id']);
 expect(m.owner).toHaveBeenCalledWith(id);
});
it('rejects foreign actors and malformed routes before source work',async()=>{
 m.auth.mockResolvedValue({user:{id:other},client:{from:m.from}});
 await expect(loadChangeRouting(id)).rejects.toThrow('not found');
 expect(m.owner).not.toHaveBeenCalled();
 await expect(loadChangeRouting('bad')).rejects.toThrow('not found');
});
it('rejects a scan/site mismatch',async()=>{
 m.select.mockImplementationOnce(()=>({eq:()=>({maybeSingle:async()=>({data:{id,actor_id:id,workspace_id:id,site_id:other,scan_id:other}})})}));
 await expect(loadChangeRouting(id)).rejects.toThrow('not found');
});
it('retains current ownership checks',async()=>{m.owner.mockRejectedValue(new Error('denied'));await expect(loadChangeRouting(id)).rejects.toThrow('denied');});
