import {afterEach,expect,it,vi} from "vitest";
import {scanImages} from "./image-scan";
afterEach(()=>vi.unstubAllGlobals());
function fixture(){
 const asset={id:"asset",getUrl:vi.fn(async()=>"https://cdn.example.com/image.png"),getName:async()=>"Photo"};
 const node=(id:string,children:unknown[]=[])=>({id:{element:id},type:"DivBlock",children:true,getChildren:async()=>children,getDisplayName:async()=>id});
 const image=(id:string,settings:Record<string,unknown>={})=>({...node(id),type:"Image",children:false,getSettings:async()=>settings,getAsset:async()=>asset});
 const root=node("root");
 const api={getRootElement:async()=>root,getCurrentComponent:async()=>null,getSiteInfo:async()=>({siteId:"site"}),getCurrentPage:async()=>({id:"page",getKind:async()=>"static",getName:async()=>"Home"}),getAssetById:async()=>asset};
 vi.stubGlobal("webflow",api);return {root,node,image,asset,api};
}
it("groups repeated images and caches asset metadata",async()=>{
 const f=fixture();f.root.getChildren=async()=>[f.image("one"),f.image("two")];
 const result=await scanImages(false);
 expect(result.total).toBe(2);expect(result.groups[0]?.occurrences).toHaveLength(2);
 expect(f.asset.getUrl).toHaveBeenCalledTimes(1);
});
it("excludes CMS trees and bound images even if getAsset would resolve them",async()=>{
 const f=fixture();f.root.getChildren=async()=>[{...f.node("cms",[f.image("inside")]),type:"DynamoWrapper"},f.image("bound",{assetId:{sourceType:"cms",fieldId:"photo"}})];
 expect((await scanImages(true)).total).toBe(0);
 expect(f.asset.getUrl).not.toHaveBeenCalled();
});
it("counts component placements only when enabled and excludes CMS component props",async()=>{
 const f=fixture(),leaf=f.image("leaf",{assetId:{sourceType:"prop",propId:"photo"}});
 const definition={id:"header",getInstanceCount:async()=>2,getName:async()=>"Header",getRootElement:async()=>leaf};
 const instance={...f.node("instance"),type:"ComponentInstance",getComponent:async()=>definition,searchProps:async()=>[{propId:"photo",value:{sourceType:"static"},resolvedValue:"asset"}]};
 f.root.getChildren=async()=>[instance,{...instance,id:{element:"second"}}];
 expect((await scanImages(false)).total).toBe(0);
 expect((await scanImages(true)).total).toBe(2);
 instance.searchProps=async()=>[{propId:"photo",value:{sourceType:"cms"},resolvedValue:"asset"}];
 expect((await scanImages(true)).total).toBe(0);
});
it("rejects results after switching the page",async()=>{
 const f=fixture();let calls=0;
 f.api.getCurrentPage=async()=>({id:++calls===1?"page":"other",getKind:async()=>"static",getName:async()=>"Home"});
 await expect(scanImages(false)).rejects.toThrow("página mudou");
});
