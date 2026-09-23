import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const {rpc,reader,getConnectionReader}=vi.hoisted(()=>({rpc:vi.fn(),reader:{sites:vi.fn(),collections:vi.fn(),collection:vi.fn()},getConnectionReader:vi.fn()}));
vi.mock('@/modules/auth/service',()=>({requireUser:async()=>({client:{rpc}})}));
vi.mock('./service',()=>({getConnectionReader}));
import {readMetadata,refreshMetadata,METADATA_TTL_MS} from './metadata-service';
const id='11111111-1111-4111-8111-111111111111',remote='a'.repeat(24);
const site={id,workspace_id:id,connection_id:id,webflow_site_id:remote,display_name:'Site'};
const bundle={site:{id:remote,displayName:'Site',shortName:'site'},collections:[]};
let snapshot: {site:typeof site;actorId:string;generation:string;status:string;entry:null|{data:typeof bundle;fetchedAt:string;error:null;retryAt:null}};
beforeEach(()=>{
 vi.clearAllMocks(); snapshot={site,actorId:id,generation:id,status:'ready',entry:null};
 rpc.mockImplementation(async(_name,args)=>({error:null,data:args.p_action==='claim'?{status:'claimed'}:args.p_action==='finish'?{status:'saved'}:snapshot}));
 getConnectionReader.mockResolvedValue({connection:{id,workspace_id:id,actor_id:id},reader});
 reader.sites.mockResolvedValue([bundle.site]);reader.collections.mockResolvedValue([]);
});
it('cold, warm and expired reads never retrieve credentials or call the provider',async()=>{
 expect((await readMetadata(id)).fresh).toBe(false);
 snapshot.entry={data:bundle,fetchedAt:new Date().toISOString(),error:null,retryAt:null};
 expect((await readMetadata(id)).fresh).toBe(true);
 snapshot.entry.fetchedAt=new Date(Date.now()-METADATA_TTL_MS-1).toISOString();
 const expired=await readMetadata(id);expect(expired.fresh).toBe(false);expect(expired.denied).toBe(false);
 expect(getConnectionReader).not.toHaveBeenCalled();expect(reader.sites).not.toHaveBeenCalled();
});
it('coalesces concurrent explicit refreshes without persisting a credential cache',async()=>{
 await Promise.all([refreshMetadata(id),refreshMetadata(id)]);
 expect(getConnectionReader).toHaveBeenCalledTimes(1);expect(reader.sites).toHaveBeenCalledTimes(1);expect(reader.collections).toHaveBeenCalledTimes(1);
 await refreshMetadata(id);expect(getConnectionReader).toHaveBeenCalledTimes(2);
});
it('denied connections do not start refresh, and cooldown preserves Retry-After without credentials',async()=>{
 snapshot.status='denied';await expect(refreshMetadata(id)).rejects.toThrow('Reconnect');
 snapshot.status='ready';rpc.mockImplementation(async(_name,args)=>({error:null,data:args.p_action==='claim'?{status:'cooldown',retryAt:new Date(Date.now()+30000).toISOString()}:snapshot}));
 await expect(refreshMetadata(id)).rejects.toMatchObject({kind:'rate_limit'});expect(getConnectionReader).not.toHaveBeenCalled();
});
