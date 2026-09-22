/// <reference types="@webflow/designer-extension-typings" />
import {z} from "zod";
import {linkSnapshot,linkSnapshotSchema,stableLinkValue,replaceLinkSnapshot} from "../../../modules/static-text/link-edit";
import type {TextNode} from "../../../modules/static-text/plan";

export const linkElementKey=(element:AnyElement)=>JSON.stringify(element.id);
const object=z.record(z.string(),z.unknown());
type Source=TextNode["source"];
type Target={id:string;value:unknown;source?:Source;set:(value:unknown)=>Promise<unknown>};
type Prop={value:unknown;target?:Target};
const propRows=z.array(z.object({propId:z.string(),value:z.unknown(),resolvedValue:z.unknown(),display:z.object({label:z.string()}).optional()}));
export function resolveLinkBinding(value:unknown,props:ReadonlyMap<string,Prop>):Prop {
 const parsed=object.safeParse(value);
 if(!parsed.success||!("sourceType" in parsed.data))return {value};
 return parsed.data.sourceType==="prop"&&typeof parsed.data.propId==="string"?props.get(parsed.data.propId)??{value:undefined}:{value:undefined};
}
export async function linkElementAllowed(element:AnyElement,props:ReadonlyMap<string,Prop>){
 if(/Collection|Dynamo|Code|Embed|RichText/.test(element.type))return false;
 if(element.type==="DOM"){
  const tag=resolveLinkBinding(await element.getTag({bindings:true}),props).value;
  if(typeof tag!=="string"||/^(script|style|iframe|object|embed|template|svg|math)$/i.test(tag)||tag.includes("-"))return false;
 }
 return true;
}
export async function instanceLinkProps(element:ComponentElement,parent:ReadonlyMap<string,Prop>,source:Source){
 const component=await element.getComponent(),name=await component.getName(),values=new Map<string,Prop>();
 for(const prop of propRows.parse(await element.searchProps())){
  const raw=object.safeParse(prop.value);
  if(raw.success&&raw.data.sourceType==="static"){
   const id=JSON.stringify(["link-prop",element.id,prop.propId]);
   values.set(prop.propId,{value:prop.resolvedValue,target:{id,value:prop.resolvedValue,source:source??{kind:"component-prop",componentName:name,componentId:component.id,instanceId:linkElementKey(element),propId:prop.propId,propName:prop.display?.label??prop.propId},set:async value=>element.setProps([{propId:prop.propId,value:linkSnapshotSchema.parse({value,footprint:""}).value as LinkResolvedValue}])}});
  }else values.set(prop.propId,resolveLinkBinding(prop.value,parent));
 }
 return values;
}
export async function elementLinkTarget(element:AnyElement,props:ReadonlyMap<string,Prop>,source:Source):Promise<Target|null>{
 const settings="getSettings" in element?object.parse(await element.getSettings()):{};
 const resolved=resolveLinkBinding(settings.link,props);
 if(resolved.value!=null){
  if(resolved.target)return resolved.target;
  if(!("setSettings" in element))return null;
  return {id:JSON.stringify(["link-setting",element.id]),value:resolved.value,source,set:async value=>element.setSettings({link:linkSnapshotSchema.parse({value,footprint:""}).value as LinkResolvedValue})};
 }
 if(settings.link!=null)return null;
 if(element.attributes){
  const attrs=await element.getAttributes();
  for(let index=0;index<attrs.length;index++){
   const attr=attrs[index]!;
   // A bound attribute name is not an editable href.
   if(attr.name!=="href")continue;
   const href=resolveLinkBinding(attr.value,props);
   if(href.target)return href.target;
   if(typeof href.value!=="string")return null;
   return {id:JSON.stringify(["link-href",element.id,index]),value:href.value,source,set:async value=>element.setAttribute(index,{name:"href",value:z.string().parse(value)})};
  }
 }
 return null;
}

export async function readButtonText(element:AnyElement,props:ReadonlyMap<string,Prop>,budget={remaining:80}):Promise<string>{
 if(--budget.remaining<0)return "";
 if(element.type==="String")return (await element.getText())??"";
 if(element.type==="ComponentInstance"||!await linkElementAllowed(element,props))return "";
 const settings="getSettings" in element?object.parse(await element.getSettings()):{};
 const text=resolveLinkBinding(settings.textContent??settings.text,props).value;
 if(typeof text==="string")return text.slice(0,500);
 if(!element.children)return "";
 const parts:string[]=[];
 for(const child of await element.getChildren())parts.push(await readButtonText(child,props,budget));
 return parts.join("").replace(/\s+/g," ").trim().slice(0,500);
}

export async function resolveLinkRoute(route:string[]){
 let element=await webflow.getRootElement(),props:ReadonlyMap<string,Prop>=new Map(),source:Source;
 for(let index=0;index<route.length;index++){
  if(!element||linkElementKey(element)!==route[index]||!await linkElementAllowed(element,props))return null;
  if(index===route.length-1)return elementLinkTarget(element,props,source);
  if(element.type==="ComponentInstance"){
   const component=await element.getComponent();
   if(component.codeComponent||component.readOnly)return null;
   props=await instanceLinkProps(element,props,source);
   source={kind:"component-definition",componentId:component.id,componentName:await component.getName(),instanceCount:await component.getInstanceCount()};
   element=await component.getRootElement();
  }else{
   if(!element.children)return null;
   element=(await element.getChildren()).find(child=>linkElementKey(child)===route[index+1])??null;
  }
 }
 return null;
}

export class LinkTargets {
 private targets=new Map<string,{route:string[];snapshot:string;source:Source}>();
 private reads=new Map<string,string>();
 async register(route:string[],provided?:Target|null){
  const target=provided===undefined?await resolveLinkRoute(route):provided;if(!target)return null;
  let snapshot:string;
  try{snapshot=linkSnapshot(target.value,stableLinkValue({id:target.id,source:target.source}));}catch{return null;}
  if(!this.targets.has(target.id))this.targets.set(target.id,{route,snapshot,source:target.source});
  return {targetId:target.id,snapshot:this.targets.get(target.id)!.snapshot,source:target.source};
 }
 async read(id:string){
  this.reads.delete(id);const cached=this.targets.get(id);if(!cached)return null;
  const target=await resolveLinkRoute(cached.route);if(!target||target.id!==id)return null;
  let snapshot:string;try{snapshot=linkSnapshot(target.value,stableLinkValue({id:target.id,source:target.source}));}catch{return null;}
  this.reads.set(id,snapshot);return snapshot;
 }
 async write(id:string,after:string){
  const previous=this.reads.get(id);if(!previous||await this.read(id)!==previous)throw new Error("O link mudou. Faça outra busca.");
  const cached=this.targets.get(id)!;
  const target=await resolveLinkRoute(cached.route);if(!target||target.id!==id)throw new Error("Link indisponível.");
  const next=linkSnapshotSchema.parse(JSON.parse(after));
  if(next.footprint!==stableLinkValue({id:target.id,source:target.source})||linkSnapshot(target.value,next.footprint)!==previous)throw new Error("O link mudou. Faça outra busca.");
  const url=typeof next.value==="string"?next.value:typeof next.value.to==="string"?next.value.to:null;
  if(!url||replaceLinkSnapshot(previous,url)!==after)throw new Error("Prévia de link inválida.");
  await target.set(next.value);
 }
}
