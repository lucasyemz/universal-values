import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/modules/auth/service",()=>({requireUser:vi.fn()}));
vi.mock("./change-service",()=>({loadChangeRequest:vi.fn()}));
vi.mock("./slug-service",()=>({prepareItemSlugs:vi.fn()}));
vi.mock("./inline-actions",()=>({readInlinePreview:vi.fn()}));
import { requireUser } from "@/modules/auth/service";
import { loadChangeRequest } from "./change-service";
import { readInlinePreview } from "./inline-actions";
import { prepareInlineRevert } from "./revert-inline-actions";
import { fixture,id,other } from "./inline-preview.fixture";
const rpc=vi.fn();
beforeEach(()=>{vi.clearAllMocks();rpc.mockResolvedValue({error:null});vi.mocked(requireUser).mockResolvedValue({client:{rpc}} as unknown as Awaited<ReturnType<typeof requireUser>>);const view=fixture();view.request.status="completed";view.request.results=[{sourceKey:"source",status:"applied",actual:"New",message:"ok"}];vi.mocked(loadChangeRequest).mockResolvedValue(view);vi.mocked(readInlinePreview).mockResolvedValue({ok:false,message:"fixture"});});
it("prepares selected fields only, without confirming a CMS write",async()=>{
 await prepareInlineRevert({id:other,originalId:id,sources:["source"]});
 expect(rpc).toHaveBeenCalledExactlyOnceWith("preview_cms_revert",{p_id:other,p_original_id:id,p_sources:["source"]});
 expect(readInlinePreview).toHaveBeenCalledWith(other);
});
it("rejects unapplied fields and denied ownership",async()=>{
 expect((await prepareInlineRevert({id:other,originalId:id,sources:["missing"]})).ok).toBe(false);
 vi.mocked(loadChangeRequest).mockRejectedValue(new Error("Forbidden"));
 expect((await prepareInlineRevert({id:other,originalId:id,sources:["source"]})).ok).toBe(false);
 expect(rpc).not.toHaveBeenCalled();
});
