import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({owner:vi.fn(),from:vi.fn(),query:{select:vi.fn(),eq:vi.fn(),in:vi.fn(),order:vi.fn(),limit:vi.fn()}}));
vi.mock("@/modules/auth/service",()=>({requireUser:async()=>({client:{from:mocks.from}})}));
vi.mock("@/modules/scans/service",()=>({getScanSite:mocks.owner}));
import {managedSourceLabels} from "./source-labels";
beforeEach(()=>{vi.resetAllMocks();mocks.from.mockReturnValue(mocks.query);for(const method of ['select','eq','in','order'] as const)mocks.query[method].mockReturnValue(mocks.query);});
it("authorizes the site and uses only scoped saved labels, newest first",async()=>{
 mocks.query.limit.mockResolvedValue({data:[{source_key:"a",item_name:"Oak Meadows",collection_name:"Properties",field_name:"Short details"},{source_key:"a",item_name:"Older name",collection_name:"Properties",field_name:"Short details"}],error:null});
 const result=await managedSourceLabels("site",["a","a"]);
 expect(mocks.owner).toHaveBeenCalledWith("site");expect(mocks.query.eq).toHaveBeenCalledWith("site_id","site");expect(mocks.query.in).toHaveBeenCalledWith("source_key",["a"]);
 expect(result.a?.item_name).toBe("Oak Meadows");expect(mocks.query.select).toHaveBeenCalledWith("source_key,item_name,collection_name,field_name,cms_scans!inner(created_at)");expect(mocks.query.order).toHaveBeenCalledWith("cms_scans(created_at)",{ascending:false});
});
it("does not read labels for a denied site",async()=>{mocks.owner.mockRejectedValue(new Error("Forbidden"));await expect(managedSourceLabels("foreign",["a"])).rejects.toThrow();expect(mocks.from).not.toHaveBeenCalled();});
it("missing saved names do not invent customer item names",async()=>{mocks.query.limit.mockResolvedValue({data:[],error:null});expect(await managedSourceLabels("site",["a"])).toEqual({});});

it("reports query failure instead of pretending the source has no name",async()=>{mocks.query.limit.mockResolvedValue({data:null,error:{code:"42703"}});await expect(managedSourceLabels("site",["a"])).rejects.toThrow("Não foi possível carregar os nomes");});
