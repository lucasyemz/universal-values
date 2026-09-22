import {ImageTargets,imageProps,type ImageProps} from "./image-target";
import type {TextNode} from "../../../modules/static-text/plan";
import type {EditableImage} from "../../../modules/static-text/image-plan";
/// <reference types="@webflow/designer-extension-typings" />
import { DesignerTextPort } from "./adapter";
import { elementLocation, shortLocation, type LocationPart } from "./element-location";
import { linkElementAllowed, resolveLinkBinding } from "./link-target";

export type ImageOccurrence=EditableImage;
export type ImageGroup={url:string;name:string;occurrences:ImageOccurrence[]};
export function groupImages(occurrences:ImageOccurrence[]):ImageGroup[]{
 const groups=new Map<string,ImageGroup>();
 for(const item of occurrences){
  const group=groups.get(item.url)??{url:item.url,name:item.name,occurrences:[]};
  group.occurrences.push(item);groups.set(item.url,group);
 }
 return [...groups.values()].sort((a,b)=>b.occurrences.length-a.occurrences.length||a.url.localeCompare(b.url));
}
function safeImageUrl(value:unknown):string|null{
 if(typeof value!=="string")return null;
 try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)?url.href:null;}catch{return null;}
}
type Props=ImageProps;
export async function scanImages(includeComponents:boolean,targets?:ImageTargets){
 const port=new DesignerTextPort(),context=await port.context();
 const occurrences:ImageOccurrence[]=[],assets=new Map<string,{url:string;name:string}>();
 let visited=0,skipped=0;
 const walk=async(element:AnyElement,path:string[],parts:LocationPart[],props:Props,definitions:Set<string>,component?:string,source?:TextNode["source"]):Promise<void>=>{
  if(++visited>3000)throw new Error("Página acima do limite de 3.000 elementos para imagens.");
  const key=JSON.stringify(element.id);if(path.includes(key)){skipped++;return;}
  const route=[...path,key];
  if(element.type==="ComponentInstance"){
   if(!includeComponents){skipped++;return;}
   const definition=await element.getComponent();
   if(definition.codeComponent||definition.readOnly||definitions.has(definition.id)){skipped++;return;}
   const values=await imageProps(element,props,source);
   const root=await definition.getRootElement(),name=await definition.getName();
   if(root)await walk(root,route,[],values,new Set([...definitions,definition.id]),component?component+" → "+name:name,{kind:"component-definition",componentId:definition.id,componentName:name,instanceCount:await definition.getInstanceCount()});
   return;
  }
  if(!await linkElementAllowed(element,props)){skipped++;return;}
  const location=[...parts,await elementLocation(element)];
  let image:{url:string;name:string}|undefined;
  if(element.type==="Image"){
   const settings=await element.getSettings();
   // Never use resolved CMS/conditional data, including forwarded component props.
   const bound=[settings.assetId,settings.src].some(value=>value!==null&&typeof value==="object"&&"sourceType" in value&&resolveLinkBinding(value,props).value==null);
   if(bound){skipped++;return;}
   const assetId=resolveLinkBinding(settings.assetId,props).value;
   const asset=typeof assetId==="string"?await webflow.getAssetById(assetId):await element.getAsset();
   if(asset){
    image=assets.get(asset.id);
    if(!image){const url=safeImageUrl(await asset.getUrl());if(url){image={url,name:await asset.getName()};assets.set(asset.id,image);}}
   }
  }else if(element.type==="DOM"&&resolveLinkBinding(await element.getTag({bindings:true}),props).value==="img"){
   const attrs=await element.getAttributes();
   const url=safeImageUrl(resolveLinkBinding(attrs.find(attr=>attr.name==="src")?.value,props).value);
   if(url)image={url,name:String(resolveLinkBinding(attrs.find(attr=>attr.name==="alt")?.value,props).value??"")||url.split("/").at(-1)!};
   else skipped++;
  }
  if(image){
   const writable=targets?await targets.register(route,element,props,source):null;
   occurrences.push({...image,id:JSON.stringify(route),location:shortLocation(location),component,...writable});
  }
  if(element.children)for(const child of await element.getChildren())await walk(child,route,location,props,definitions,component,source);
 };
 const root=await webflow.getRootElement();if(root)await walk(root,[],[],new Map(),new Set());
 if(JSON.stringify(await port.context())!==JSON.stringify(context))throw new Error("A página mudou durante a busca. Tente novamente.");
 return {context,groups:groupImages(occurrences),total:occurrences.length,skipped};
}
