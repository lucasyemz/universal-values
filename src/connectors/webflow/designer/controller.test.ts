import { expect, it, vi } from "vitest";
vi.mock("./dashboard-client",()=>({DesignerDashboardClient:class { preview=vi.fn(async (plan: unknown)=>plan); }}));
import { DesignerController } from "./controller";
import { preparePlan } from "@/modules/static-text/plan";
const context={siteId:"site",pageId:"page",pageName:"Home",rootId:"root"};
it("persists exactly the locally displayed plan, retaining retry identity without applying",async()=>{
 const controller=new DesignerController();
 const plan=preparePlan(context,[{id:"a",text:"old"}],"old",{'["a",0]':"new"});
 const apply=vi.spyOn(controller,"apply");
 expect(await controller.saveTextPreview(plan,"old")).toEqual(plan);
 expect(await controller.saveTextPreview(plan,"old")).toEqual(plan);
 expect(controller.dashboard.preview).toHaveBeenLastCalledWith(plan,"old");
 expect(apply).not.toHaveBeenCalled();
});
it("blocks a persisted response different from the visible text plan",async()=>{
 const controller=new DesignerController();
 const plan=preparePlan(context,[{id:"a",text:"old"}],"old",{'["a",0]':"new"});
 vi.mocked(controller.dashboard.preview).mockResolvedValue({...plan,changes:[{id:"a",before:"old",after:"unexpected"}]});
 await expect(controller.saveTextPreview(plan,"old")).rejects.toThrow("Prévia alterada");
});
