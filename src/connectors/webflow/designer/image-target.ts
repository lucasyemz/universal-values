import {RemoteImages} from "./remote-image";
/// <reference types="@webflow/designer-extension-typings" />
import {imageAssetSchema,imageSnapshot,imageSnapshotSchema,replaceImageSnapshot,type ImageAsset} from "../../../modules/static-text/image-edit";
import {stableLinkValue} from "../../../modules/static-text/link-edit";
import type {TextNode} from "../../../modules/static-text/plan";
import {linkElementAllowed} from "./link-target";
type Source=TextNode["source"];
type Prop={value:unknown;owner?:ComponentElement;propId?:string;source?:Source};
export type ImageProps=ReadonlyMap<string,Prop>;
export async function imageProps(element:ComponentElement,parent:ImageProps,source:Source):Promise<ImageProps>{
 const definition=await element.getComponent(),values=new Map<string,Prop>();
 for(const prop of await element.searchProps()){
  values.set(prop.propId,prop.value.sourceType==="static"?{value:prop.resolvedValue,owner:element,propId:prop.propId,source:source??{kind:"component-prop",componentName:await definition.getName(),componentId:definition.id,instanceId:JSON.stringify(element.id),propId:prop.propId,propName:prop.display?.label??prop.propId}}:prop.value.sourceType==="prop"?parent.get(prop.value.propId)??{value:undefined}:{value:undefined});
 }
 return values;
}
async function assetInfo(asset:Asset){return imageAssetSchema.parse({id:asset.id,url:await asset.getUrl(),name:await asset.getName()});}
export async function imageTarget(element:AnyElement,props:ImageProps,source:Source){
 if(element.type==="Image"){
  const settings=await element.getSettings(),raw=settings.assetId;
  const binding=raw&&typeof raw==="object"&&"sourceType" in raw?raw:null;
  if(binding&&binding.sourceType!=="prop")return null;
  const prop=binding?.sourceType==="prop"?props.get(binding.propId):undefined;
  if(binding&&!prop?.owner)return null;
  const src=settings.src;
  if(src&&typeof src==="object"&&"sourceType" in src)return null;
  const asset=prop?typeof prop.value==="string"?await webflow.getAssetById(prop.value):null:await element.getAsset();
  if(!asset)return null;
  const info=await assetInfo(asset);
  const id=JSON.stringify(prop?["image-prop",prop.owner!.id,prop.propId]:["image-asset",element.id]);
  const targetSource=prop?prop.source:source;
  return {id,snapshot:imageSnapshot({kind:"asset",assetId:info.id,url:info.url,footprint:stableLinkValue({id,source:targetSource,binding})}),source:targetSource,
   set:async(next:ImageAsset)=>{
    const asset=await webflow.getAssetById(next.id);
    if(!asset||await asset.getUrl()!==next.url||!(await asset.getMimeType()).startsWith("image/"))throw new Error("A imagem de destino mudou. Gere outra prévia.");
    if(prop)await prop.owner!.setProps([{propId:prop.propId!,value:next.id}]);else await element.setAsset(asset);
   }};
 }
 if(element.type==="DOM"&&await element.getTag({bindings:true})==="img"){
  const attrs=await element.getAttributes();
  if(attrs.some(a=>a.name==="srcset"||typeof a.name!=="string"))return null;
  const index=attrs.findIndex(a=>a.name==="src");
  const value=attrs[index]?.value;
  // Bound DOM attributes cannot be replaced without changing their binding.
  if(typeof value!=="string")return null;
  const id=JSON.stringify(["image-src",element.id,index]);
  return {id,snapshot:imageSnapshot({kind:"url",assetId:null,url:value,footprint:stableLinkValue({id,source,attrs:attrs.filter((_,i)=>i!==index)})}),source,set:async(next:ImageAsset)=>{
   // Preserve other attributes but reject srcset, which could override the reviewed URL.
   if(attrs.some(a=>a.name==="srcset"||typeof a.name!=="string"))throw new Error("Imagem responsiva não editável nesta extensão.");
   await element.setAttribute(index,{name:"src",value:next.url});
  }};
 }
 return null;
}
async function resolveImageRoute(route:string[]){
 let element=await webflow.getRootElement(),props:ImageProps=new Map(),source:Source;
 for(let i=0;i<route.length;i++){
  if(!element||JSON.stringify(element.id)!==route[i]||!await linkElementAllowed(element,props))return null;
  if(element.type==="DOM"&&await element.getTag({bindings:true})==="picture")return null;
  if(i===route.length-1)return imageTarget(element,props,source);
  if(element.type==="ComponentInstance"){
   const def=await element.getComponent();if(def.codeComponent||def.readOnly)return null;
   props=await imageProps(element,props,source);
   source={kind:"component-definition",componentId:def.id,componentName:await def.getName(),instanceCount:await def.getInstanceCount()};
   element=await def.getRootElement();
  }else element=element.children?(await element.getChildren()).find(child=>JSON.stringify(child.id)===route[i+1])??null:null;
 }
 return null;
}
export class ImageTargets{
 readonly remote=new RemoteImages();
 private routes=new Map<string,string[]>();
 private reads=new Map<string,string>();
 private assets=new Map<string,ImageAsset>();
 async register(route:string[],element:AnyElement,props:ImageProps,source:Source){
  // srcset/picture sources would invalidate a simple src replacement.
  if(element.type==="DOM"&&(await element.getAttributes()).some(a=>a.name==="srcset"))return null;
  const target=element.type==="DOM"?await resolveImageRoute(route):await imageTarget(element,props,source);if(!target)return null;
  this.routes.set(target.id,route);return {targetId:target.id,snapshot:target.snapshot,source:target.source};
 }
 authorize(assets:ImageAsset[]){this.assets=new Map(assets.map(a=>[a.id,a]));}
 async read(id:string){
  this.reads.delete(id);const route=this.routes.get(id);if(!route)return null;
  const target=await resolveImageRoute(route);if(!target||target.id!==id)return null;
  const parsed=imageSnapshotSchema.parse(JSON.parse(target.snapshot));
  const requested=this.remote.requestedFor(parsed.assetId,parsed.url);
  const snapshot=requested?imageSnapshot({...parsed,assetId:requested.id,url:requested.url}):target.snapshot;
  this.reads.set(id,snapshot);return snapshot;
 }
 async write(id:string,after:string){
  const before=this.reads.get(id);if(!before||await this.read(id)!==before)throw new Error("A imagem mudou. Faça outra busca.");
  const target=await resolveImageRoute(this.routes.get(id)!);if(!target||target.id!==id||target.snapshot!==before)throw new Error("A imagem mudou. Faça outra busca.");
  const parsed=imageSnapshotSchema.parse(JSON.parse(after));
  const asset=[...this.assets.values()].find(a=>a.url===parsed.url&&(parsed.kind==="url"||a.id===parsed.assetId));
  if(!asset||replaceImageSnapshot(before,asset)!==after)throw new Error("Prévia de imagem inválida.");
  const resolved=parsed.kind==="asset"?await this.remote.materialize(asset):asset;
  // Importing is asynchronous: recheck the original target before changing its value.
  if(await this.read(id)!==before)throw new Error("A imagem mudou. Faça outra busca.");
  await target.set(resolved);
 }
}
