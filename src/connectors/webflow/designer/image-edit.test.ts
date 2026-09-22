import {afterEach,expect,it,vi} from "vitest";
import {scanImages} from "./image-scan";
import {ImageTargets} from "./image-target";
import {prepareImagesPlan} from "../../../modules/static-text/image-plan";
import {applyPlan,type AuditEvent} from "../../../modules/static-text/apply";
import {DesignerTextPort} from "./adapter";
afterEach(()=>vi.unstubAllGlobals());
function fixture(){
 const asset=(id:string)=>({id,getUrl:async()=>"https://cdn.example/"+id+".png",getName:async()=>id,getMimeType:async()=>"image/png"});
 const old=asset("old"),next=asset("new");
 let current=old,settings:Record<string,unknown>={};
 const setter=vi.fn(async(value:typeof old)=>{current=value;});
 const image={id:{element:"image"},type:"Image",children:false,getSettings:async()=>settings,getAsset:async()=>current,setAsset:setter,getDisplayName:async()=>"Hero"};
 const root={id:{element:"root"},type:"Body",children:true,getChildren:async()=>[image]};
 vi.stubGlobal("webflow",{getRootElement:async()=>root,getCurrentComponent:async()=>null,getSiteInfo:async()=>({siteId:"site"}),getCurrentPage:async()=>({id:"page",getKind:async()=>"static",getName:async()=>"Home"}),getAssetById:async(id:string)=>id==="old"?old:next,createAsset:vi.fn(async()=>next)});
 return {setter,next,change:()=>{current=asset("external");},bindCms:()=>{settings={assetId:{sourceType:"cms"}};}};
}
async function setup(){
 const f=fixture(),targets=new ImageTargets(),scan=await scanImages(false,targets);
 const asset={id:"new",url:await f.next.getUrl(),name:"new"};
 const plan=prepareImagesPlan(scan.context,scan.groups,{[scan.groups[0]!.url]:{selected:[scan.groups[0]!.occurrences[0]!.id],asset}});
 targets.authorize([asset]);
 const events:AuditEvent[]=[],store={load:()=>events,append:(e:AuditEvent)=>{events.push(e);}};
 const port={context:()=>new DesignerTextPort().context(),read:(id:string)=>targets.read(id),write:(id:string,v:string)=>targets.write(id,v)};
 return {...f,targets,scan,plan,events,store,port};
}
it("does not write during preview; confirms, verifies and deduplicates apply",async()=>{
 const f=await setup();expect(f.setter).not.toHaveBeenCalled();
 await expect(applyPlan(f.plan,false,f.port,f.store)).rejects.toThrow("Confirme");
 await applyPlan(f.plan,true,f.port,f.store,async()=>{});
 await applyPlan(f.plan,true,f.port,f.store,async()=>{});
 expect(f.setter).toHaveBeenCalledTimes(1);
 expect(f.events.map(e=>e.status)).toEqual(["confirmed","dispatching","applied"]);
});
it.each(["external","cms"])("rejects %s changes before writing",async(kind)=>{
 const f=await setup();if(kind==="external")f.change();else f.bindCms();
 await expect(applyPlan(f.plan,true,f.port,f.store,async()=>{})).rejects.toThrow();
 expect(f.setter).not.toHaveBeenCalled();expect(f.events.at(-1)?.status).toBe("conflict");
});
it("rejects a stale persisted preview",async()=>{
 const f=await setup();f.events.push({plan:structuredClone(f.plan),status:"confirmed",at:new Date().toISOString(),confirmedAt:new Date().toISOString()});
 f.plan.expiresAt+=1000;
 await expect(applyPlan(f.plan,true,f.port,f.store,async()=>{})).rejects.toThrow("Prévia alterada");
 expect(f.setter).not.toHaveBeenCalled();
});
it("updates a component image prop locally without changing the definition or other instances",async()=>{
 const makeAsset=(id:string)=>({id,getName:async()=>id,getUrl:async()=>"https://cdn.example/"+id+".png",getMimeType:async()=>"image/png"});
 const old=makeAsset("old"),next=makeAsset("new");
 const leaf={id:{component:"component",element:"image"},type:"Image",children:false,getDisplayName:async()=>"Logo",getSettings:async()=>({assetId:{sourceType:"prop",propId:"photo"}})};
 const definition={id:"header",getName:async()=>"Header",getRootElement:async()=>leaf,getInstanceCount:async()=>2};
 function instance(id:string){
  let value="old";
  return {id:{component:"page",element:id},type:"ComponentInstance",getComponent:async()=>definition,searchProps:async()=>[{propId:"photo",value:{sourceType:"static"},resolvedValue:value,display:{label:"Photo"}}],setProps:vi.fn(async(props:{propId:string;value:string}[])=>{value=props[0]!.value;})};
 }
 const a=instance("first"),b=instance("second"),root={type:"Body",id:{component:"page",element:"root"},children:true,getChildren:async()=>[a,b]};
 vi.stubGlobal("webflow",{getRootElement:async()=>root,getCurrentComponent:async()=>null,getSiteInfo:async()=>({siteId:"site"}),getCurrentPage:async()=>({id:"page",getKind:async()=>"static",getName:async()=>"Home"}),getAssetById:async(id:string)=>id==="old"?old:next});
 const targets=new ImageTargets(),scan=await scanImages(true,targets),asset={id:"new",url:await next.getUrl(),name:"new"};
 const plan=prepareImagesPlan(scan.context,scan.groups,{[scan.groups[0]!.url]:{selected:[scan.groups[0]!.occurrences[0]!.id],asset}});
 targets.authorize([asset]);
 const events:AuditEvent[]=[];
 await applyPlan(plan,true,{context:()=>new DesignerTextPort().context(),read:id=>targets.read(id),write:(id,value)=>targets.write(id,value)},{load:()=>events,append:e=>{events.push(e);}},async()=>{});
 expect(a.setProps).toHaveBeenCalledTimes(1);expect(b.setProps).not.toHaveBeenCalled();
 expect(plan.changes[0]!.source?.kind).toBe("component-prop");
});

it("imports a direct URL only after audit and verifies the resulting native asset",async()=>{
 const f=await setup();
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(new Uint8Array([1,2,3]),{headers:{"content-type":"image/png"}})));
 const remote=await f.targets.remote.prepare("https://external.example/photo.png");
 const plan=prepareImagesPlan(f.scan.context,f.scan.groups,{[f.scan.groups[0]!.url]:{selected:[f.scan.groups[0]!.occurrences[0]!.id],asset:remote}});
 f.targets.authorize([remote]);
 expect(webflow.createAsset).not.toHaveBeenCalled();expect(f.setter).not.toHaveBeenCalled();
 await applyPlan(plan,true,f.port,f.store,async()=>{});
 await applyPlan(plan,true,f.port,f.store,async()=>{});
 expect(webflow.createAsset).toHaveBeenCalledTimes(1);expect(f.setter).toHaveBeenCalledTimes(1);
 expect(f.events.at(-1)?.observed).toBe(plan.changes[0]!.after);
 expect(f.events.map(e=>e.status)).toEqual(["confirmed","dispatching","applied"]);
 f.targets.remote.dispose();
});
