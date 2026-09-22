import { buildRequestPlan, changeRequestSchema } from "./change-request-plan";
import type { Occurrence } from "./schema";
export const id="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
export function fixture(name=false,batch=false) {
 const o={id,scan_id:id,site_id:id,source_key:"source",collection_id:"a".repeat(24),collection_name:"CMS",item_id:"b".repeat(24),item_name:"Item",locale:"",field_slug:name?"name":"description",field_name:name?"Name":"Description",field_type:"PlainText",source_value:"Old",raw_match:"Old",start_pos:0,end_pos:3,canonical:{type:"text",text:"Old"}} as Occurrence;
 const occurrences=batch?[o,{...o,id:other,source_key:"source2",item_id:"c".repeat(24)}]:[o];
 const request=changeRequestSchema.parse({id,scan_id:id,site_id:id,workspace_id:id,actor_id:id,connection_id:id,changes:occurrences.map(row=>({occurrenceId:row.id,after:{type:"text",text:"New"}})),status:"preview",cursor:0,total:occurrences.length,dispatched:false,lease_until:null,retry_at:null,expires_at:"2099-01-01T00:00:00Z",results:[],...(name?{slug_updates:{source:{before:"old",after:"new"}}}:{})});
 return buildRequestPlan(request,occurrences);
}
