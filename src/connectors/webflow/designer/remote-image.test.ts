import {afterEach,expect,it,vi} from "vitest";
import {RemoteImages} from "./remote-image";
afterEach(()=>vi.unstubAllGlobals());
function fixture(){
 const createAsset=vi.fn(async()=>({id:"created",getUrl:async()=>"https://cdn.example/import.png",getName:async()=>"import.png"}));
 const fetcher=vi.fn(async()=>new Response(new Uint8Array([1,2,3]),{headers:{"content-type":"image/png"}}));
 vi.stubGlobal("webflow",{createAsset});vi.stubGlobal("fetch",fetcher);
 return {createAsset,fetcher,remote:new RemoteImages()};
}
it("stages URL bytes without writing and imports once on confirmed dispatch",async()=>{
 const f=fixture(),asset=await f.remote.prepare("https://example.com/photo.png");
 expect(f.createAsset).not.toHaveBeenCalled();
 expect(f.remote.previewUrl(asset)).toMatch(/^blob:/);
 const actual=await f.remote.materialize(asset);
 await f.remote.materialize(asset);
 expect(f.createAsset).toHaveBeenCalledTimes(1);
 expect(f.fetcher).toHaveBeenCalledTimes(1);
 expect(f.remote.requestedFor(actual.id,actual.url)).toEqual(asset);
 expect(f.remote.requestedFor(actual.id,"https://cdn.example/changed.png")).toBeUndefined();
 f.remote.dispose();
});
it("keeps uncertain import failures from being retried",async()=>{
 const f=fixture();f.createAsset.mockRejectedValue(new Error("network"));
 const asset=await f.remote.prepare("https://example.com/photo.png");
 await expect(f.remote.materialize(asset)).rejects.toThrow("network");
 await expect(f.remote.materialize(asset)).rejects.toThrow("network");
 expect(f.createAsset).toHaveBeenCalledTimes(1);f.remote.dispose();
});
it("rejects unsafe URLs, non-images, over-limit responses and CORS failures before writes",async()=>{
 const f=fixture();
 await expect(f.remote.prepare("javascript:alert(1)")).rejects.toThrow();
 f.fetcher.mockResolvedValue(new Response("<html/>",{headers:{"content-type":"text/html"}}));
 await expect(f.remote.prepare("https://example.com/page")).rejects.toThrow("arquivo");
 f.fetcher.mockResolvedValue(new Response("x",{headers:{"content-type":"image/png","content-length":"5000000"}}));
 await expect(f.remote.prepare("https://example.com/large")).rejects.toThrow("4 MB");
 f.fetcher.mockRejectedValue(new Error("cors"));
 await expect(f.remote.prepare("https://example.com/blocked")).rejects.toThrow("CORS");
 expect(f.createAsset).not.toHaveBeenCalled();
});
