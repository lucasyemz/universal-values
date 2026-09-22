import {afterEach, expect, it, vi} from "vitest";
import {DesignerTextPort} from "./adapter";
import {editableComponentText} from "./component-text";
import {findMentions,preparePlan} from "../../../modules/static-text/plan";
import {applyPlan, type AuditEvent} from "../../../modules/static-text/apply";
const prop = (text="Welcome") => ({propId:"title",valueType:"textContent",value:{sourceType:"static",value:text},resolvedValue:text,display:{label:"Title"}});
function fixture(){
 let text="Welcome", bound=false, definition="hero";
 const instance={type:"ComponentInstance", id:{component:"page",element:"instance"}, getParentComponent:async()=>null,
 getComponent:async()=>({id:definition,codeComponent:false,readOnly:false,getName:async()=>"Hero",getInstanceCount:async()=>1,getRootElement:async()=>null}),
 searchProps:async()=>[{...prop(text),value:bound?{sourceType:"cms"}:prop(text).value}],
 setProps:vi.fn(async(values:{propId:string;value:string}[])=>{text=values[0]!.value;})};
 const root={type:"Body",id:{component:"page",element:"root"},children:true,getParentComponent:async()=>null,getSettings:async()=>({}),getChildren:async()=>[instance]};
 const api={getCurrentComponent:async()=>null,getCurrentPage:async()=>({id:"page",getKind:async()=>"static",getName:async()=>"Home"}),getRootElement:async()=>root,getSiteInfo:async()=>({siteId:"site"})};
 vi.stubGlobal("webflow",api);
 return {instance,root,bind:()=>{bound=true;},replace:()=>{definition="another";}};
}
afterEach(()=>vi.unstubAllGlobals());
it("excludes components by default and includes exposed text only when opted in",async()=>{
 const f=fixture(),port=new DesignerTextPort();
 expect((await port.scan()).nodes).toHaveLength(0);
 expect(f.instance.setProps).not.toHaveBeenCalled();
 const scan=await port.scan(true);
 expect(scan.nodes).toHaveLength(1);
 expect(scan.nodes[0]?.source).toMatchObject({componentName:"Hero",propName:"Title",kind:"component-prop"});
 await port.scan(false);
 expect(await port.read(scan.nodes[0]!.id)).toBeNull();
 await expect(port.write(scan.nodes[0]!.id,"Other")).rejects.toThrow();
});
it("keeps component scope in mentions, preview and audit and writes only the instance property",async()=>{
 const f=fixture(),port=new DesignerTextPort(),scan=await port.scan(true);
 const mention=findMentions(scan.nodes,"Welcome")[0]!;
 const plan=preparePlan(scan.context,scan.nodes,"Welcome",{[mention.key]:"Hello"});
 expect(plan.changes[0]?.source).toEqual(mention.source);
 const events:AuditEvent[]=[];
 await expect(applyPlan(plan,false,port,{load:()=>events,append:e=>{events.push(e);}},async()=>{})).rejects.toThrow("Confirme");
 expect(f.instance.setProps).not.toHaveBeenCalled();
 const store={load:()=>events,append:(e:AuditEvent)=>{events.push(e);}};
 await applyPlan(plan,true,port,store,async()=>{});
 await applyPlan(plan,true,port,store,async()=>{});
 expect(f.instance.setProps).toHaveBeenCalledExactlyOnceWith([{propId:"title",value:"Hello"}]);
 expect(events.at(-1)).toMatchObject({status:"applied",observed:"Hello"});
});
it.each(["binding","definition","removed"])("blocks a %s change after scan",async(kind)=>{
 const f=fixture(),port=new DesignerTextPort(),scan=await port.scan(true),id=scan.nodes[0]!.id;
 if(kind==="binding")f.bind(); else if(kind==="definition")f.replace(); else f.root.getChildren=async()=>[];
 expect(await port.read(id)).toBeNull();
 await expect(port.write(id,"Other")).rejects.toThrow();
 expect(f.instance.setProps).not.toHaveBeenCalled();
});
it("excludes CMS/conditional bindings, rich text, links and variants",()=>{
 expect(editableComponentText([
 prop(), {...prop(),value:{sourceType:"cms"}}, {...prop(),value:{sourceType:"conditional"}},
 {...prop(),valueType:"richText"}, {...prop(),valueType:"link"}, {...prop(),display:{label:"Variant",options:[{}]}}
 ])).toEqual([{id:"title",text:"Welcome",label:"Title"}]);
});
it("rechecks bindings immediately before setProps",async()=>{
 const f=fixture(),port=new DesignerTextPort(),scan=await port.scan(true),id=scan.nodes[0]!.id;
 expect(await port.read(id)).toBe("Welcome");
 f.bind();
 await expect(port.write(id,"Other")).rejects.toThrow();
 expect(f.instance.setProps).not.toHaveBeenCalled();
});
