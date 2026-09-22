import {z} from "zod";
import {stableLinkValue} from "./link-edit";

export const imageUrlSchema=z.url().max(2000).refine(value=>{
 try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}
});
export const imageAssetSchema=z.object({id:z.string().min(1),url:imageUrlSchema,name:z.string().max(500)});
export type ImageAsset=z.infer<typeof imageAssetSchema>;
export const imageSnapshotSchema=z.object({
 kind:z.enum(["asset","url"]),assetId:z.string().nullable(),url:imageUrlSchema,footprint:z.string(),
});
export function imageSnapshot(value:z.infer<typeof imageSnapshotSchema>){return stableLinkValue(imageSnapshotSchema.parse(value));}
export function replaceImageSnapshot(before:string,asset:ImageAsset){
 const current=imageSnapshotSchema.parse(JSON.parse(before)),next=imageAssetSchema.parse(asset);
 return imageSnapshot({...current,assetId:current.kind==="asset"?next.id:null,url:next.url});
}
export const imageReviewSchema=z.object({
 beforeUrl:imageUrlSchema,asset:imageAssetSchema,locations:z.array(z.string().max(2000)).min(1).max(100),
});
export function validImageEdit(before:string,after:string,review:z.infer<typeof imageReviewSchema>){
 try{return imageSnapshotSchema.parse(JSON.parse(before)).url===review.beforeUrl&&replaceImageSnapshot(before,review.asset)===after;}catch{return false;}
}
export function observedImage(value:string){try{return imageSnapshotSchema.parse(JSON.parse(value)).url;}catch{return value;}}
