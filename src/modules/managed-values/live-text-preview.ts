import { occurrenceReplacement } from "@/modules/scans/change-plan";
import type { Occurrence } from "@/modules/scans/schema";

export type LiveTextSource = {
 sourceKey:string; source:string; fieldType:"PlainText"|"RichText";
 locations:{start:number;end:number;raw:string}[];
};
/** Display-only calculation over saved exact ranges. Never a confirmation payload. */
export function liveTextComparison(source:LiveTextSource,replacement:string) {
 const chars=[...source.source];let end=chars.length;
 try{
  for(const location of [...source.locations].sort((a,b)=>b.start-a.start)){
   if(location.start<0 || location.end> end || location.end<=location.start || chars.slice(location.start,location.end).join("")!==location.raw)return null;
   const occurrence:Occurrence={id:"",scan_id:"",site_id:"",source_key:source.sourceKey,collection_id:"",collection_name:"",item_id:"",item_name:"",locale:"",field_slug:"",field_name:"",field_type:source.fieldType,source_value:source.source,raw_match:location.raw,start_pos:location.start,end_pos:location.end,canonical:{type:"text",text:location.raw}};
   const next=occurrenceReplacement(occurrence,{type:"text",text:replacement.trim()},true);
   chars.splice(location.start,location.end-location.start,...next);end=location.start;
  }
  const after=chars.join("");
  return after.length<=20000?{before:source.source,after}:null;
 }catch{return null;}
}
