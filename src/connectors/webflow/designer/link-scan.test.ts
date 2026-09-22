import {afterEach,expect,it,vi} from "vitest";
import {scanRepeatedLinks} from "./link-scan";
import {LinkTargets} from "./link-target";
import {prepareLinkPlan,prepareLinksPlan,initialLinkDraft} from "../../../modules/static-text/repeated-links";
import {applyPlan,type AuditEvent} from "../../../modules/static-text/apply";
import {DesignerTextPort} from "./adapter";

function fixture(){
 type Node={type:string;id:{component:string;element:string};children:boolean;attributes:boolean;displayName:boolean;
 setSettings:(value:Record<string,unknown>)=>Promise<null>;getSettings:()=>Promise<Record<string,unknown>>;getChildren:()=>Promise<Node[]>;getAttributes:()=>Promise<unknown[]>;
 setAttribute?:(index:number,value:{name:string;value:string})=>Promise<null>;getDisplayName:()=>Promise<string>;getParentComponent:()=>Promise<null>;getTag:()=>Promise<string>;
 getComponent?:()=>Promise<Definition>;searchProps?:()=>Promise<unknown[]>};
 type Definition={id:string;codeComponent:boolean;readOnly:boolean;getInstanceCount:()=>Promise<number>;getName:()=>Promise<string>;getRootElement:()=>Promise<Node>};
 const node=(id:string,settings:Record<string,unknown>={},children:Node[]=[]):Node=>({type:"DivBlock",id:{component:"page",element:id},children:true,attributes:true,displayName:true,
 setSettings:async value=>{Object.assign(settings,value);return null;},getSettings:async()=>settings,getChildren:async()=>children,getAttributes:async()=>[],getDisplayName:async()=>id,getParentComponent:async()=>null,getTag:async()=>"a"});
 const a=node("CTA",{link:{mode:"page",to:{pageId:"contact"}}});a.type="Link";
 const b=node("Footer link");b.type="DOM";b.getAttributes=async()=>[{name:"href",value:"/contact"}];
 const root=node("root",{},[a,b]);root.type="Body";
 const api={getCurrentComponent:async()=>null,getCurrentPage:async()=>({id:"page",getKind:async()=>"static",getName:async()=>"Home"}),getRootElement:async()=>root,getSiteInfo:async()=>({siteId:"site"}),
 getAllPagesAndFolders:vi.fn(async()=>[{type:"Page",id:"contact",getName:async()=>"Contact",getPublishPath:async()=>"/contact"}])};
 vi.stubGlobal("webflow",api);return{a,b,root,api,node};
}
afterEach(()=>vi.unstubAllGlobals());
it("finds a native page link repeated by a DOM href with one page metadata read",async()=>{
 const f=fixture(),result=await scanRepeatedLinks(false);
 expect(result.groups[0]?.occurrences.map(o=>o.label)).toEqual(["CTA","Footer link"]);
 expect(result.total).toBe(2);expect(f.api.getAllPagesAndFolders).toHaveBeenCalledTimes(1);
});
it("resolves nested component link props at their actual elements and counts each instance",async()=>{
 const f=fixture();
 const leaf=f.node("button",{link:{sourceType:"prop",propId:"url"}});
 const definition={id:"button",codeComponent:false,readOnly:false,getInstanceCount:async()=>2,getName:async()=>"Button",getRootElement:async()=>leaf};
 const nested={...f.node("nested"),type:"ComponentInstance",getComponent:async()=>definition,searchProps:async()=>[{propId:"url",value:{sourceType:"prop",propId:"cta"},resolvedValue:null}]};
 const outerDef={id:"header",codeComponent:false,readOnly:false,getInstanceCount:async()=>2,getName:async()=>"Header",getRootElement:async()=>f.node("header-root",{},[nested])};
 const outer={...f.node("first"),type:"ComponentInstance",getComponent:async()=>outerDef,searchProps:async()=>[{propId:"cta",value:{sourceType:"static"},resolvedValue:{mode:"url",to:"/signup"}}]};
 f.root.getChildren=async()=>[outer,{...outer,id:{component:"page",element:"second"}}];
 expect((await scanRepeatedLinks(false)).total).toBe(0);
 const result=await scanRepeatedLinks(true);
 expect(result.total).toBe(2);expect(result.groups[0]?.occurrences).toHaveLength(2);
 expect(result.groups[0]?.occurrences[0]?.location).toBe("Header → Button");
 expect(f.api.getAllPagesAndFolders).not.toHaveBeenCalled();
});
it("excludes CMS collection trees, unresolved bindings and script content",async()=>{
 const f=fixture();f.a.type="DynamoWrapper";
 f.b.getAttributes=async()=>[{name:"href",value:{sourceType:"cms",fieldId:"link"}}];
 expect((await scanRepeatedLinks(true)).total).toBe(0);
 f.b.getTag=async()=>"script";f.b.getAttributes=async()=>[{name:"href",value:"/contact"}];
 expect((await scanRepeatedLinks(true)).total).toBe(0);
});
it("rejects results when the current page changes during the read",async()=>{
 const f=fixture();let calls=0;
 f.api.getCurrentPage=async()=>({id:++calls>1?"other":"page",getKind:async()=>"static",getName:async()=>"Home"});
 await expect(scanRepeatedLinks(false)).rejects.toThrow("página mudou");
});

it("shows button text and edits only selected link fields after confirmation, preserving settings",async()=>{
 const f=fixture(),targets=new LinkTargets();
 const text={...f.node("text"),type:"String",getText:async()=>"Get for Free"};
 f.a.getChildren=async()=>[text];
 const value={mode:"url",to:"/contact",openInNewTab:true,rel:"nofollow"};
 const settings:{link:unknown}={link:value};
 f.a.getSettings=async()=>settings;
 f.a.setSettings=vi.fn(async next=>{Object.assign(settings,next);return null;});
 const scan=await scanRepeatedLinks(false,targets),group=scan.groups[0]!;
 expect(group.occurrences[0]?.text).toBe("Get for Free");
 const selected=group.occurrences[0]!.targetId!;
 const plan=prepareLinkPlan(scan.context,group,[selected],"/signup");
 expect(plan.changes[0]?.link?.buttons).toEqual(["Get for Free · Home"]);
 const events:AuditEvent[]=[],store={load:()=>events,append:(event:AuditEvent)=>{events.push(event);}};
 const port={context:()=>new DesignerTextPort().context(),read:(id:string)=>targets.read(id),write:(id:string,text:string)=>targets.write(id,text)};
 await expect(applyPlan(plan,false,port,store,async()=>{})).rejects.toThrow("Confirme");
 expect(f.a.setSettings).not.toHaveBeenCalled();
 await applyPlan(plan,true,port,store,async()=>{});
 await applyPlan(plan,true,port,store,async()=>{});
 expect(f.a.setSettings).toHaveBeenCalledExactlyOnceWith({link:{...value,to:"/signup"}});
 expect(events.at(-1)?.status).toBe("applied");
 expect(await text.getText()).toBe("Get for Free");
 expect(await f.b.getAttributes()).toEqual([{name:"href",value:"/contact"}]);
});

it("blocks a changed link before dispatch and rejects stale selections",async()=>{
 const f=fixture(),targets=new LinkTargets(),scan=await scanRepeatedLinks(false,targets),group=scan.groups[0]!;
 const plan=prepareLinkPlan(scan.context,group,[group.occurrences[0]!.targetId!],"/other");
 expect(plan.changes[0]?.link?.convertsPage).toBe(true);
 expect(()=>prepareLinkPlan(scan.context,group,["forged"],"/other")).toThrow();
 f.a.getSettings=async()=>({link:{mode:"url",to:"/changed"}});
 f.a.setSettings=vi.fn();
 const events:AuditEvent[]=[];
 await expect(applyPlan(plan,true,{context:()=>new DesignerTextPort().context(),read:id=>targets.read(id),write:(id,text)=>targets.write(id,text)},{load:()=>events,append:e=>{events.push(e);}},async()=>{})).rejects.toThrow("Nenhuma nova escrita");
 expect(f.a.setSettings).not.toHaveBeenCalled();
});

it("deduplicates a shared nested property and preserves its global scope",async()=>{
 const f=fixture();let value={mode:"url",to:"/contact",openInNewTab:true};
 const leaf=f.node("button",{link:{sourceType:"prop",propId:"url"}});
 const button={id:"button",codeComponent:false,readOnly:false,getInstanceCount:async()=>2,getName:async()=>"Button",getRootElement:async()=>leaf};
 const setProps=vi.fn(async(props:{propId:string;value:typeof value}[])=>{value=props[0]!.value;return null;});
 const nested={...f.node("nested"),type:"ComponentInstance",getComponent:async()=>button,searchProps:async()=>[{propId:"url",value:{sourceType:"static"},resolvedValue:value}],setProps};
 const header={id:"header",codeComponent:false,readOnly:false,getInstanceCount:async()=>12,getName:async()=>"Header",getRootElement:async()=>f.node("header-root",{},[nested])};
 const instance={...f.node("first"),type:"ComponentInstance",getComponent:async()=>header,searchProps:async()=>[]};
 f.root.getChildren=async()=>[instance,{...instance,id:{component:"page",element:"second"}}];
 const targets=new LinkTargets(),scan=await scanRepeatedLinks(true,targets),group=scan.groups[0]!;
 expect(group.occurrences).toHaveLength(2);
 expect(group.occurrences[0]?.source).toMatchObject({kind:"component-definition",componentName:"Header",instanceCount:12});
 const plan=prepareLinkPlan(scan.context,group,group.occurrences.map(o=>o.targetId!),"/signup");
 expect(plan.changes).toHaveLength(1);expect(plan.changes[0]?.link?.buttons).toHaveLength(2);
 const events:AuditEvent[]=[],store={load:()=>events,append:(e:AuditEvent)=>{events.push(e);}};
 await applyPlan(plan,true,{context:()=>new DesignerTextPort().context(),read:id=>targets.read(id),write:(id,text)=>targets.write(id,text)},store,async()=>{});
 expect(setProps).toHaveBeenCalledExactlyOnceWith([{propId:"url",value:{mode:"url",to:"/signup",openInNewTab:true}}]);
});

it("updates only the DOM href and stops before writing when audit storage fails",async()=>{
 const f=fixture(),attributes=[{name:"class",value:"button"},{name:"href",value:"/contact"},{name:"target",value:"_blank"}];
 f.b.getAttributes=async()=>attributes;
 f.b.setAttribute=vi.fn(async(index,value)=>{attributes[index]=value;return null;});
 const targets=new LinkTargets(),scan=await scanRepeatedLinks(false,targets),group=scan.groups[0]!;
 const plan=prepareLinkPlan(scan.context,group,[group.occurrences[1]!.targetId!],"/signup");
 const port={context:()=>new DesignerTextPort().context(),read:(id:string)=>targets.read(id),write:(id:string,value:string)=>targets.write(id,value)};
 await expect(applyPlan(plan,true,port,{load:()=>[],append:()=>{throw new Error("storage unavailable");}},async()=>{})).rejects.toThrow("storage");
 expect(f.b.setAttribute).not.toHaveBeenCalled();
 const events:AuditEvent[]=[];
 await applyPlan(plan,true,port,{load:()=>events,append:e=>{events.push(e);}},async()=>{});
 expect(f.b.setAttribute).toHaveBeenCalledExactlyOnceWith(1,{name:"href",value:"/signup"});
 expect(attributes).toEqual([{name:"class",value:"button"},{name:"href",value:"/signup"},{name:"target",value:"_blank"}]);
});

it("blocks removed targets and replaced native destinations with dynamic bindings",async()=>{
 const f=fixture(),targets=new LinkTargets(),scan=await scanRepeatedLinks(false,targets),id=scan.groups[0]!.occurrences[0]!.targetId!;
 expect(await targets.read(id)).not.toBeNull();
 f.a.getSettings=async()=>({link:{sourceType:"cms",fieldId:"url"}});
 expect(await targets.read(id)).toBeNull();
 f.root.getChildren=async()=>[];
 expect(await targets.read(id)).toBeNull();
});

it("includes a unique destination and applies it only after confirmation",async()=>{
 const f=fixture(),targets=new LinkTargets();
 f.root.getChildren=async()=>[f.a];
 const settings:{link:unknown}={link:{mode:"url",to:"/unique"}};
 f.a.getSettings=async()=>settings;
 f.a.setSettings=vi.fn(async next=>{Object.assign(settings,next);return null;});
 const scan=await scanRepeatedLinks(false,targets);
 expect(scan.groups).toHaveLength(1);
 const group=scan.groups[0]!;
 expect(group.occurrences).toHaveLength(1);
 const plan=prepareLinkPlan(scan.context,group,[group.occurrences[0]!.targetId!],"/updated");
 expect(f.a.setSettings).not.toHaveBeenCalled();
 const events:AuditEvent[]=[],store={load:()=>events,append:(event:AuditEvent)=>{events.push(event);}};
 const port={context:()=>new DesignerTextPort().context(),read:(id:string)=>targets.read(id),write:(id:string,text:string)=>targets.write(id,text)};
 await expect(applyPlan(plan,false,port,store,async()=>{})).rejects.toThrow("Confirme");
 expect(f.a.setSettings).not.toHaveBeenCalled();
 await applyPlan(plan,true,port,store,async()=>{});
 expect(f.a.setSettings).toHaveBeenCalledExactlyOnceWith({link:{mode:"url",to:"/updated"}});
 expect(events.at(-1)?.status).toBe("applied");
});

it("reviews changed groups together, excludes unchanged groups and rejects invalid batch edits",async()=>{
 const f=fixture(),targets=new LinkTargets();
 const second=f.node("Second",{link:{mode:"url",to:"/second"}}),unchanged=f.node("Unchanged",{link:{mode:"url",to:"/unchanged"}});
 second.type="Link";unchanged.type="Link";
 f.root.getChildren=async()=>[f.a,second,unchanged];
 const scan=await scanRepeatedLinks(false,targets);
 const drafts=Object.fromEntries(scan.groups.map(group=>[group.key,initialLinkDraft(group)]));
 const firstGroup=scan.groups.find(g=>g.input==="/contact")!,secondGroup=scan.groups.find(g=>g.input==="/second")!;
 drafts[firstGroup.key]!.url="/new-contact";drafts[secondGroup.key]!.url="/new-second";
 const plan=prepareLinksPlan(scan.context,scan.groups,drafts);
 expect(plan.changes).toHaveLength(2);
 expect(plan.changes.map(c=>c.link?.afterUrl)).toEqual(["/new-contact","/new-second"]);
 const events:AuditEvent[]=[],store={load:()=>events,append:(event:AuditEvent)=>{events.push(event);}};
 const port={context:()=>new DesignerTextPort().context(),read:(id:string)=>targets.read(id),write:(id:string,text:string)=>targets.write(id,text)};
 await applyPlan(plan,true,port,store,async()=>{});
 expect(await unchanged.getSettings()).toEqual({link:{mode:"url",to:"/unchanged"}});
 expect(await second.getSettings()).toEqual({link:{mode:"url",to:"/new-second"}});
 drafts[secondGroup.key]!.url="javascript:alert(1)";
 expect(()=>prepareLinksPlan(scan.context,scan.groups,drafts)).toThrow();
 drafts[secondGroup.key]!.url="/second";
 expect(prepareLinksPlan(scan.context,scan.groups,drafts).changes).toHaveLength(1);
 drafts[firstGroup.key]!.selected=[];
 expect(()=>prepareLinksPlan(scan.context,scan.groups,drafts)).toThrow("Nenhuma alteração");
});
