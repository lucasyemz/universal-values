import {beforeEach,expect,it,vi} from "vitest";
vi.mock('./metadata-service',()=>({readMetadata:vi.fn()}));
vi.mock('./service',()=>({loadSiteContent:vi.fn(),loadWorkspaceSites:vi.fn(),settingsAvailableSites:vi.fn()}));
import {readMetadata} from './metadata-service';
import {loadSiteContent} from './service';
import {explorerStructure,loadLiveCms} from './explorer-actions';
const id='11111111-1111-4111-8111-111111111111',collectionId='a'.repeat(24);
const scope={actorId:id,workspaceId:id,siteId:id,connectionId:id,generation:id};
const saved={actorId:id,generation:id,site:{id,workspace_id:id,connection_id:id},denied:false,data:null,entry:null};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(readMetadata).mockResolvedValue(saved as unknown as Awaited<ReturnType<typeof readMetadata>>);});
it('allows stale/missing structure without provider reads',async()=>{
 expect(await explorerStructure({scope,collectionId})).toEqual({ok:true,details:null,fetchedAt:null});expect(loadSiteContent).not.toHaveBeenCalled();
});
it('denies changed scope before live reads and rejects content arriving after reconnect',async()=>{
 expect((await loadLiveCms({scope:{...scope,generation:'22222222-2222-4222-8222-222222222222'},siteId:id,collectionId})).ok).toBe(false);
 expect(loadSiteContent).not.toHaveBeenCalled();
 vi.mocked(readMetadata).mockResolvedValueOnce(saved as unknown as Awaited<ReturnType<typeof readMetadata>>).mockResolvedValueOnce({...saved,generation:'changed'} as unknown as Awaited<ReturnType<typeof readMetadata>>);
 expect((await loadLiveCms({scope,siteId:id,collectionId})).ok).toBe(false);
});
it('preserves rate limits and rejects rapid retries before another credential/provider read',async()=>{
 const {WebflowError}=await import('@/connectors/webflow/client');
 vi.mocked(loadSiteContent).mockRejectedValueOnce(new WebflowError('rate_limit',30));
 expect(await loadLiveCms({scope,siteId:id,collectionId})).toMatchObject({ok:false,retryAfter:30,code:'rate_limit'});
 expect(await loadLiveCms({scope,siteId:id,collectionId})).toMatchObject({ok:false,code:'rate_limit'});
 expect(loadSiteContent).toHaveBeenCalledTimes(1);
});
