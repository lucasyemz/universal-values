import {z} from "zod";

export const newLinkSchema = z.string().trim().min(1).max(2000).refine(value => {
  if (/[\s\\\u0000-\u001f]/.test(value)) return false;
  if (/^\/(?!\/)|^[#?]/.test(value)) return true;
  try {const url=new URL(value);return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password;} catch{return false;}
}, "Informe uma URL http(s), um caminho /pagina ou uma âncora #secao.");
const valueSchema=z.union([z.string(),z.discriminatedUnion("mode",[z.object({mode:z.literal("url"),to:z.string()}).passthrough(),z.object({mode:z.literal("page"),to:z.object({pageId:z.string()})}).passthrough(),z.object({mode:z.literal("pageSection"),to:z.object({fullElementId:z.object({component:z.string(),element:z.string()})})}).passthrough()])]);
export const linkSnapshotSchema=z.object({value:valueSchema,footprint:z.string()});
export function stableLinkValue(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(stableLinkValue).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stableLinkValue(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function linkSnapshot(value:unknown,footprint:string){return stableLinkValue(linkSnapshotSchema.parse({value,footprint}));}
export function replaceLinkSnapshot(before:string,input:string){
 const snapshot=linkSnapshotSchema.parse(JSON.parse(before)),url=newLinkSchema.parse(input);
 const value=typeof snapshot.value==="string"?url:{...snapshot.value,mode:"url",to:url};
 return linkSnapshot(value,snapshot.footprint);
}
export const linkReviewSchema=z.object({beforeLabel:z.string().max(2000),afterUrl:newLinkSchema,buttons:z.array(z.string().max(500)).min(1).max(100),convertsPage:z.boolean()});
export function validLinkEdit(before:string,after:string,url:string,convertsPage?:boolean){try{
 const value=linkSnapshotSchema.parse(JSON.parse(before)).value;
 return (convertsPage===undefined||convertsPage===(typeof value!=="string"&&["page","pageSection"].includes(value.mode)))&&replaceLinkSnapshot(before,url)===after;
}catch{return false;}}
export function observedLink(value:string){try{const snapshot=linkSnapshotSchema.parse(JSON.parse(value));return typeof snapshot.value==="string"?snapshot.value:typeof snapshot.value.to==="string"?snapshot.value.to:"Página interna";}catch{return value;}}
