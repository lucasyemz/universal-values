import {planSchema,type PageContext,type TextNode,type TextPlan} from "./plan";
import type {ReviewedOccurrence} from "./continue-scan";
import {imageUrlSchema,replaceImageSnapshot,type ImageAsset} from "./image-edit";

export type EditableImage={id:string;url:string;name:string;location:string;component?:string;targetId?:string;snapshot?:string;source?:TextNode["source"]};
export type ImageDraft={selected:string[];url?:string;asset?:ImageAsset};
export type ImageGroup={url:string;name:string;occurrences:EditableImage[]};
export function changedImages(groups:ImageGroup[],drafts:Record<string,ImageDraft>){
 return groups.flatMap(group=>{
  const draft=drafts[group.url];
  return draft?.asset&&draft.asset.url!==group.url?group.occurrences.filter(o=>draft.selected.includes(o.id)&&o.targetId&&o.snapshot).map(o=>({occurrence:o,asset:draft.asset!})):[];
 });
}
export function prepareImagesPlan(context:PageContext,groups:ImageGroup[],drafts:Record<string,ImageDraft>){
 for(const [key,draft] of Object.entries(drafts)){
  const group=groups.find(g=>g.url===key);
  if(!group||draft.selected.some(id=>!group.occurrences.some(o=>o.id===id&&o.targetId&&o.snapshot)))throw new Error("Seleção de imagens inválida.");
 }
 const selected=changedImages(groups,drafts);
 const changes=new Map<string,TextPlan["changes"][number]>();
 for(const {occurrence:o,asset} of selected){
  const aliases=groups.flatMap(g=>g.occurrences).filter(item=>item.targetId===o.targetId);
  if(aliases.some(alias=>!selected.some(item=>item.occurrence.id===alias.id&&item.asset.id===asset.id&&item.asset.url===asset.url)))throw new Error("Esta imagem é compartilhada. Selecione todas as ocorrências vinculadas e use a mesma imagem.");
  const after=replaceImageSnapshot(o.snapshot!,asset);
  const existing=changes.get(o.targetId!);
  if(existing&&existing.after!==after)throw new Error("Destinos diferentes para a mesma imagem compartilhada.");
  changes.set(o.targetId!,{id:o.targetId!,before:o.snapshot!,after,source:o.source,image:{beforeUrl:o.url,asset,locations:aliases.map(a=>[a.component,a.location].filter(Boolean).join(" · ").slice(0,2000))}});
 }
 if(!changes.size)throw new Error("Nenhuma alteração selecionada.");
 return planSchema.parse({id:crypto.randomUUID(),context,expiresAt:Date.now()+15*60000,changes:[...changes.values()]});
}
export function continueImageScan(groups:ImageGroup[],drafts:Record<string,ImageDraft>,plan:TextPlan){
 const ids=new Set(plan.changes.map(c=>c.id));
 const remaining=groups.map(g=>({...g,occurrences:g.occurrences.filter(o=>!o.targetId||!ids.has(o.targetId))})).filter(g=>g.occurrences.length);
 return {groups:remaining,drafts:Object.fromEntries(remaining.flatMap(g=>drafts[g.url]?[[g.url,{...drafts[g.url],selected:drafts[g.url]!.selected.filter(id=>g.occurrences.some(o=>o.id===id))}]]:[]))};
}

export function reviewedImages(plan:TextPlan,groups:ImageGroup[]):ReviewedOccurrence[]{
 return plan.changes.flatMap(change=>groups.flatMap(g=>g.occurrences.filter(o=>o.targetId===change.id).map(o=>({...change,reviewKey:JSON.stringify([plan.id,o.id]),pageName:plan.context.pageName,location:[o.component,o.location].filter(Boolean).join(" · ")}))));
}

export function changedImageCount(groups:ImageGroup[],drafts:Record<string,ImageDraft>){
 return groups.reduce((sum,g)=>{
  const draft=drafts[g.url],url=draft?.url?.trim();
  if(!draft||!url||url===g.url||!imageUrlSchema.safeParse(url).success)return sum;
  return sum+g.occurrences.filter(o=>draft.selected.includes(o.id)&&o.targetId).length;
 },0);
}
