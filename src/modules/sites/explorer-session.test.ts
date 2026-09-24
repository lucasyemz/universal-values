import {expect,it,vi} from "vitest";
import {ExplorerSession,EXPLORER_PAGE_TTL,EXPLORER_MAX_PAGES,type ExplorerPage} from "./explorer-session";
const scope={actorId:"actor",workspaceId:"workspace",siteId:"site",connectionId:"connection",generation:"generation"};
const page:ExplorerPage={scope,collectionId:"collection",offset:0,locale:"",structureVersion:null};
it("reuses collection/page hits, bounds pages and expires without fetching automatically",async()=>{
 let now=0;const cache=new ExplorerSession<number>(()=>now),fetcher=vi.fn(async()=>7);
 expect(await cache.load(page,fetcher,()=>true)).toBe(7);
 await cache.load({...page,offset:25},fetcher,()=>true);
 await cache.load(page,fetcher,()=>true);expect(fetcher).toHaveBeenCalledTimes(2);
 now=EXPLORER_PAGE_TTL;expect(cache.get(page)).toBeUndefined();expect(fetcher).toHaveBeenCalledTimes(2);
 for(let i=0;i<=EXPLORER_MAX_PAGES;i++)await cache.load({...page,offset:i*25},fetcher,()=>true);
 expect(cache.get(page)).toBeUndefined();
});
it("isolates every identity, locale, schema version and collection",async()=>{
 const cache=new ExplorerSession<number>();await cache.load(page,async()=>1,()=>true);
 for(const key of Object.keys(scope) as (keyof typeof scope)[])expect(cache.get({...page,scope:{...scope,[key]:"different"}})).toBeUndefined();
 for(const variant of [{locale:"pt"},{collectionId:"other"},{structureVersion:"new"},{offset:25}])expect(cache.get({...page,...variant})).toBeUndefined();
});
it("coalesces requests and drops late cache writes after refresh/unmount",async()=>{
 const cache=new ExplorerSession<number>();let resolve!:(value:number)=>void;
 const fetcher=vi.fn(()=>new Promise<number>(done=>{resolve=done;}));
 const one=cache.load(page,fetcher,()=>true),two=cache.load(page,fetcher,()=>true);
 expect(fetcher).toHaveBeenCalledTimes(1);cache.clear();resolve(1);await Promise.all([one,two]);expect(cache.get(page)).toBeUndefined();
});
it("does not cache errors or failed results and can retry",async()=>{
 const cache=new ExplorerSession<boolean>();await expect(cache.load(page,async()=>{throw new Error('failure');},()=>true)).rejects.toThrow();
 await cache.load(page,async()=>false,value=>value);expect(cache.get(page)).toBeUndefined();
 await cache.load(page,async()=>true,value=>value);expect(cache.get(page)).toBe(true);
});
