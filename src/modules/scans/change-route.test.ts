import { expect, it, vi } from "vitest";
vi.mock("next/navigation",()=>({redirect:vi.fn((url:string)=>{throw new Error(url);})}));
vi.mock("./change-service",()=>({loadChangeRequest:vi.fn()}));
vi.mock("@/components/scans/change-details",()=>({ChangeDetails:vi.fn()}));
import ChangePage from "@/app/dashboard/changes/[id]/page";
import { loadChangeRequest } from "./change-service";
import { fixture,id } from "./inline-preview.fixture";
it("redirects old result URLs to the scan review preserving errors",async()=>{
 vi.mocked(loadChangeRequest).mockResolvedValue(fixture());
 await expect(ChangePage({params:Promise.resolve({id}),searchParams:Promise.resolve({error:"cancel"})})).rejects.toThrow(`/dashboard/scans/${id}?filter=reviewed&operation=${id}&operationError=cancel`);
});
it("does not redirect to scan information before ownership is validated",async()=>{
 vi.mocked(loadChangeRequest).mockRejectedValue(new Error("Forbidden"));
 await expect(ChangePage({params:Promise.resolve({id}),searchParams:Promise.resolve({})})).rejects.toThrow("Forbidden");
});
