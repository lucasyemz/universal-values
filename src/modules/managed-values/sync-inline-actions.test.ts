import { beforeEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({redirect:vi.fn()}));
vi.mock("@/modules/auth/service",()=>({requireUser:vi.fn()}));
vi.mock("./sync-service",()=>({loadManagedSyncValue:vi.fn()}));
vi.mock("./sync-plan",()=>({buildManagedSyncPlan:vi.fn()}));
vi.mock("@/modules/scans/slug-service",()=>({prepareItemSlugs:vi.fn()}));
vi.mock("@/modules/scans/inline-actions",()=>({readInlinePreview:vi.fn()}));
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { loadManagedSyncValue } from "./sync-service";
import { prepareItemSlugs } from "@/modules/scans/slug-service";
import { readInlinePreview } from "@/modules/scans/inline-actions";
import { prepareInlineManagedSync } from "./sync-actions";
const id="11111111-1111-4111-8111-111111111111",rpc=vi.fn();
beforeEach(()=>{
 vi.clearAllMocks();vi.mocked(requireUser).mockResolvedValue({client:{rpc}} as unknown as Awaited<ReturnType<typeof requireUser>>);
 vi.mocked(loadManagedSyncValue).mockResolvedValue({value:{id,version:1,archived_at:null,canonical:{type:"text",text:"Before"}},bindings:[],missingMigration:false} as unknown as Awaited<ReturnType<typeof loadManagedSyncValue>>);
 rpc.mockResolvedValue({error:null});vi.mocked(readInlinePreview).mockResolvedValue({ok:false,message:"Fixture receipt"});
});
it("prepares managed edits and slugs without navigation, confirmation or a provider write",async()=>{
 await prepareInlineManagedSync({id,valueId:id,version:1,replacement:"After"});
 expect(rpc).toHaveBeenCalledExactlyOnceWith("preview_managed_value_sync",{p_id:id,p_value_id:id,p_version:1,p_after:{type:"text",text:"After"}});
 expect(prepareItemSlugs).toHaveBeenCalledWith(id);expect(readInlinePreview).toHaveBeenCalledWith(id);expect(redirect).not.toHaveBeenCalled();
});
it("rejects a stale central value version before persisting a preview",async()=>{
 expect(await prepareInlineManagedSync({id,valueId:id,version:2,replacement:"After"})).toMatchObject({ok:false});expect(rpc).not.toHaveBeenCalled();
});
