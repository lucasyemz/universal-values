import {afterEach,expect,it,vi} from "vitest";
vi.stubGlobal("DESIGNER_DASHBOARD_URL","http://localhost:3000");
const {DesignerDashboardClient,DesignerAccessError}=await import("./dashboard-client");
afterEach(()=>vi.unstubAllGlobals());
it("only treats missing access and unauthorized sessions as reconnect errors",async()=>{
 vi.stubGlobal("DESIGNER_DASHBOARD_URL","http://localhost:3000");
 const client=new DesignerDashboardClient();
 await expect(client.home("site")).rejects.toBeInstanceOf(DesignerAccessError);
 const code="uvd_"+"a".repeat(64);
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({error:"Expired"}),{status:401})));
 await expect(client.connect(code,"site")).rejects.toBeInstanceOf(DesignerAccessError);
 for(const status of [403,409,503]){
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({error:"Unavailable"}),{status})));
  await expect(client.connect(code,"site")).rejects.not.toBeInstanceOf(DesignerAccessError);
 }
 vi.stubGlobal("fetch",vi.fn(async()=>{throw new TypeError("Network offline");}));
 await expect(client.connect(code,"site")).rejects.not.toBeInstanceOf(DesignerAccessError);
});
