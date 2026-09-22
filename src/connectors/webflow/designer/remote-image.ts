import {imageAssetSchema,imageUrlSchema,type ImageAsset} from "../../../modules/static-text/image-edit";
const MAX_BYTES=4*1024*1024;
const formats:Record<string,string>={"image/png":"png","image/jpeg":"jpg","image/gif":"gif","image/webp":"webp","image/svg+xml":"svg","image/avif":"avif"};
export class RemoteImages{
 private staged=new Map<string,{file:File;descriptor:ImageAsset}>();
 private previews=new Map<string,string>();
 private imports=new Map<string,Promise<ImageAsset>>();
 private imported=new Map<string,{actual:ImageAsset;requested:ImageAsset}>();
 async prepare(input:string):Promise<ImageAsset>{
  const url=imageUrlSchema.parse(input.trim());
  let response:Response;
  try{response=await fetch(url,{credentials:"omit",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(20000)});}
  catch{throw new Error("Não foi possível ler a imagem. Use uma URL pública que permita acesso pela extensão (CORS).");}
  const mime=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()??"";
  if(!response.ok||!formats[mime])throw new Error("A URL deve retornar um arquivo de imagem válido.");
  if(Number(response.headers.get("content-length"))>MAX_BYTES||!response.body)throw new Error("Use uma imagem de até 4 MB.");
  const reader=response.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]= [];
  let size=0;
  try{
   while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>MAX_BYTES)throw new Error("Use uma imagem de até 4 MB.");chunks.push(new Uint8Array(chunk.value));}
  }finally{await reader.cancel();}
  if(!size)throw new Error("A URL deve retornar um arquivo de imagem válido.");
  const file=new File(chunks,"replaceall."+formats[mime],{type:mime});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()))).map(n=>n.toString(16).padStart(2,"0")).join("");
  const urlHash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(url)))).map(n=>n.toString(16).padStart(2,"0")).join("");
  const descriptor=imageAssetSchema.parse({id:"remote:"+hash+":"+urlHash,url,name:file.name});
  this.staged.set(descriptor.id,{file,descriptor});
  if(!this.previews.has(descriptor.id))this.previews.set(descriptor.id,URL.createObjectURL(file));
  return descriptor;
 }
 previewUrl(asset:ImageAsset){return this.previews.get(asset.id)??asset.url;}
 dispose(){for(const url of this.previews.values())URL.revokeObjectURL(url);this.previews.clear();this.staged.clear();}
 // Called only inside the audited write, after confirmation. The same file is reused for a batch.
 async materialize(requested:ImageAsset):Promise<ImageAsset>{
  if(!requested.id.startsWith("remote:"))return requested;
  const staged=this.staged.get(requested.id);
  if(!staged||staged.descriptor.url!==requested.url)throw new Error("A prévia da imagem expirou. Gere outra prévia.");
  let pending=this.imports.get(requested.id);
  if(!pending){
   pending=(async()=>{
    const asset=await webflow.createAsset(staged.file);
    const actual=imageAssetSchema.parse({id:asset.id,url:await asset.getUrl(),name:await asset.getName()});
    this.imported.set(actual.id,{actual,requested});return actual;
   })();
   // Keep rejected promises: an uncertain upload must not be automatically repeated.
   this.imports.set(requested.id,pending);
  }
  return pending;
 }
 requestedFor(assetId:string|null,url:string){
  const entry=assetId?this.imported.get(assetId):undefined;
  return entry?.actual.url===url?entry.requested:undefined;
 }
}
