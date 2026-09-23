import { beforeEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({unstable_rethrow:vi.fn()}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/auth/service",()=>({requireUser:vi.fn()}));
vi.mock("./change-service",()=>({loadChangeRequest:vi.fn()}));
vi.mock("./change-actions",()=>({previewChanges:vi.fn()}));
import { requireUser } from "@/modules/auth/service";
import { loadChangeRequest } from "./change-service";
import { previewChanges } from "./change-actions";
import { inlinePreview } from "./inline-preview";
import { confirmInlineChanges,prepareInlineChanges } from "./inline-actions";
import { fixture,id } from "./inline-preview.fixture";
const rpc=vi.fn();
beforeEach(()=>{vi.clearAllMocks();vi.mocked(loadChangeRequest).mockResolvedValue(fixture());vi.mocked(requireUser).mockResolvedValue({client:{rpc}} as unknown as Awaited<ReturnType<typeof requireUser>>);rpc.mockResolvedValue({error:null});});
it("returns a persisted preview without confirming or writing",async()=>{
 vi.mocked(previewChanges).mockResolvedValue({ok:true,id});expect((await prepareInlineChanges({})).ok).toBe(true);expect(rpc).not.toHaveBeenCalled();
});
it("rejects a missing confirmation, mismatched receipt, expired preview and denied access",async()=>{
 const digest=inlinePreview(fixture()).digest;
 expect((await confirmInlineChanges({id,digest,confirmed:false})).ok).toBe(false);
 expect((await confirmInlineChanges({id,digest:"0".repeat(64),confirmed:true})).ok).toBe(false);
 vi.mocked(loadChangeRequest).mockResolvedValue({...fixture(),expired:true});expect((await confirmInlineChanges({id,digest,confirmed:true})).ok).toBe(false);
 vi.mocked(loadChangeRequest).mockRejectedValue(new Error("Forbidden"));expect((await confirmInlineChanges({id,digest,confirmed:true})).ok).toBe(false);expect(rpc).not.toHaveBeenCalled();
});
it("confirms only the immutable request and recovers a duplicate click after completion",async()=>{
 const view=fixture(),digest=inlinePreview(view).digest;
 expect(await confirmInlineChanges({id,digest,confirmed:true})).toEqual({ok:true,id});expect(rpc).toHaveBeenCalledWith("confirm_cms_changes",{p_id:id});
 view.request.status="completed";view.expired=true;vi.mocked(loadChangeRequest).mockResolvedValue(view);
 expect((await confirmInlineChanges({id,digest,confirmed:true})).ok).toBe(true);
});
it("surfaces database conflicts without dispatching a write",async()=>{
 rpc.mockResolvedValue({error:{message:"Bindings changed"}});
 expect(await confirmInlineChanges({id,digest:inlinePreview(fixture()).digest,confirmed:true})).toMatchObject({ok:false,refresh:true});
 expect(rpc).toHaveBeenCalledTimes(1);
});

it("keeps confirmed success if the independent worker kick fails",async()=>{
 rpc.mockImplementation(async(name:string)=>{if(name==='request_cms_worker_kick')throw new Error('network');return {error:null};});
 expect(await confirmInlineChanges({id,digest:inlinePreview(fixture()).digest,confirmed:true})).toEqual({ok:true,id});
 expect(rpc.mock.calls.map(([name])=>name)).toEqual(['confirm_cms_changes','request_cms_worker_kick']);
});
