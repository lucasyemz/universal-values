import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/auth/service",()=>({requireUser:vi.fn()}));
vi.mock("./change-service",()=>({loadChangeRequest:vi.fn()}));
vi.mock("./service",()=>({loadScanResults:vi.fn()}));
import { requireUser } from "@/modules/auth/service";
import { loadChangeRequest } from "./change-service";
import { getChangeProgress, resumeChanges } from "./change-actions";
const id="11111111-1111-4111-8111-111111111111";
beforeEach(()=>vi.clearAllMocks());
describe("background progress UI actions",()=>{
  it("only reads progress and health; never advances a field",async()=>{
    vi.mocked(loadChangeRequest).mockResolvedValue({request:{id,cursor:1,total:2,status:"confirmed",background_paused:false,worker_error:null}} as Awaited<ReturnType<typeof loadChangeRequest>>);
    const rpc=vi.fn(async()=>({data:new Date().toISOString(),error:null}));
    vi.mocked(requireUser).mockResolvedValue({client:{rpc},user:{id}} as unknown as Awaited<ReturnType<typeof requireUser>>);
    expect(await getChangeProgress({id})).toMatchObject({ok:true,worker:"online",progress:{cursor:1,total:2}});
    expect(rpc).toHaveBeenCalledExactlyOnceWith("cms_worker_last_seen",{});
  });
  it("requires confirmation to resume pending work",async()=>{
    expect(await resumeChanges({id,cursor:1})).toMatchObject({ok:false});
    expect(requireUser).not.toHaveBeenCalled();
    const rpc=vi.fn(async()=>({data:id,error:null}));
    vi.mocked(requireUser).mockResolvedValue({client:{rpc},user:{id}} as unknown as Awaited<ReturnType<typeof requireUser>>);
    expect(await resumeChanges({id,cursor:1,confirmed:true})).toEqual({ok:true});
    expect(rpc).toHaveBeenCalledExactlyOnceWith("resume_background_cms",{p_id:id,p_cursor:1});
  });
});
