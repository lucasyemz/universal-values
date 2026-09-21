import { expect,it,vi } from "vitest";
import { createAiMetadataCache } from "./context-reader";
function reader(){return {sites:vi.fn(async()=>[{id:"site",displayName:"Site",shortName:"site"}]),collections:vi.fn(async()=>[{id:"collection",displayName:"CMS",slug:"cms"}]),collection:vi.fn(async()=>({id:"collection",displayName:"CMS",slug:"cms",fields:[]}))};}
it("reuses metadata for the same authorized scope and isolates accounts/connections",async()=>{
 const read=createAiMetadataCache(),r=reader();
 await read("accountA:connectionA","site","collection",r);await read("accountA:connectionA","site","collection",r);
 expect(r.sites).toHaveBeenCalledTimes(1);expect(r.collection).toHaveBeenCalledTimes(1);
 await read("accountB:connectionB","site","collection",r);expect(r.collection).toHaveBeenCalledTimes(2);
});
it("expires metadata after five minutes",async()=>{
 vi.useFakeTimers();try {const read=createAiMetadataCache(),r=reader();await read("scope","site","collection",r);vi.advanceTimersByTime(300001);await read("scope","site","collection",r);expect(r.collection).toHaveBeenCalledTimes(2);}finally{vi.useRealTimers();}
});
it("never caches failed ownership checks",async()=>{
 const read=createAiMetadataCache(),r=reader();r.collections.mockResolvedValue([]);
 await expect(read("scope","site","collection",r)).rejects.toThrow();await expect(read("scope","site","collection",r)).rejects.toThrow();
 expect(r.sites).toHaveBeenCalledTimes(2);expect(r.collection).not.toHaveBeenCalled();
});
