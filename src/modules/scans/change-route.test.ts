import { expect, it, vi } from "vitest";
vi.mock("next/navigation",()=>({redirect:vi.fn((url:string)=>{throw new Error(url);})}));
vi.mock("./change-routing",()=>({loadChangeRouting:vi.fn()}));
vi.mock("@/components/scans/change-details",()=>({ChangeDetails:vi.fn()}));
import ChangePage from "@/app/dashboard/changes/[id]/page";
import { loadChangeRouting } from "./change-routing";
import { fixture,id } from "./inline-preview.fixture";
it("redirects old result URLs to the scan review preserving errors",async()=>{
 vi.mocked(loadChangeRouting).mockResolvedValue(fixture().request);
 await expect(ChangePage({params:Promise.resolve({id}),searchParams:Promise.resolve({error:"cancel"})})).rejects.toThrow(`/dashboard/scans/${id}?filter=reviewed&operation=${id}&operationError=cancel`);
});
it("does not redirect to scan information before ownership is validated",async()=>{
 vi.mocked(loadChangeRouting).mockRejectedValue(new Error("Forbidden"));
 await expect(ChangePage({params:Promise.resolve({id}),searchParams:Promise.resolve({})})).rejects.toThrow("Forbidden");
});
