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
    vi.mocked(loadChangeRequest).mockResolvedValue({request:{id,cursor:1,total:2,status:"confirmed",results:[{status:"conflict",message:"Changed",sourceKey:"source"}],background_paused:false,worker_error:null}} as Awaited<ReturnType<typeof loadChangeRequest>>);
    const rpc=vi.fn(async(name:string)=>({data:name==="operation_progress"?{cursor:1,total:2,status:"confirmed",verified:0,issues:1,paused:false,error:null,queuePosition:1,retryAt:null,updatedAt:new Date().toISOString()}:{state:"processing",nextAt:null},error:null}));
    vi.mocked(requireUser).mockResolvedValue({client:{rpc},user:{id}} as unknown as Awaited<ReturnType<typeof requireUser>>);
    expect(await getChangeProgress({id})).toMatchObject({ok:true,worker:"processing",progress:{cursor:1,total:2,verified:0,issues:1}});
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("operation_progress",{p_id:id});
    expect(rpc).toHaveBeenCalledWith("cms_worker_status",{p_id:id});
    expect(loadChangeRequest).not.toHaveBeenCalled();
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
