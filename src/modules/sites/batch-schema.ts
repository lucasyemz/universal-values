import "server-only";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {requireUser} from "@/modules/auth/service";
import {WebflowError,type WebflowReader} from "@/connectors/webflow/client";
import {collectionSchema,collectionDetailsSchema,type WebflowSite} from "@/connectors/webflow/schemas";
import {readMetadata} from "./metadata-service";
export type BatchMetadataContext={site:WebflowSite;collections:z.infer<typeof collectionSchema>[];collectionId:string};
// Called only AFTER the runner's fresh site and collection membership checks.
// A warm schema is a detection hint, never authorization or a write-validation snapshot.
export async function readBatchSchema(siteId:string,connectionId:string,reader:Pick<WebflowReader,'collection'>,context:BatchMetadataContext) {
 const saved=await readMetadata(siteId,'schema',context.collectionId);
 if(saved.denied||saved.site.connection_id!==connectionId||saved.site.webflow_site_id!==context.site.id||!context.collections.some(c=>c.id===context.collectionId))throw new Error('source_changed');
 if(saved.fresh&&saved.data?.details?.id===context.collectionId&&saved.data.site.id===context.site.id)return saved.data.details;
 const {client}=await requireUser();const lease=randomUUID();
 const args={p_site:siteId,p_kind:'schema',p_collection:context.collectionId,p_generation:saved.generation,p_lease:lease};
 const claim=await client.rpc('webflow_metadata',{...args,p_action:'claim'});
 if(claim.error)throw new Error('source_changed');
 const state=z.object({status:z.string(),retryAt:z.string().optional()}).parse(claim.data);
 if(state.status==='cooldown')throw new WebflowError('rate_limit',Math.max(5,Math.ceil((Date.parse(state.retryAt!)-Date.now())/1000)));
 // A concurrent refresh owns the same metadata. Pause via the existing retry contract;
 // do not issue duplicate schema reads or introduce a new polling mechanism.
 if(state.status==='busy')throw new WebflowError('rate_limit',5);
 if(state.status!=='claimed')throw new Error('source_changed');
 let details:z.infer<typeof collectionDetailsSchema>;
 try {
  details=collectionDetailsSchema.parse(await reader.collection(context.collectionId));
  if(details.id!==context.collectionId)throw new WebflowError('invalid_response');
 }catch(error){
  const denied=error instanceof WebflowError&&['unauthorized','forbidden'].includes(error.kind);
  await client.rpc('webflow_metadata',{...args,p_action:'finish',p_error:denied?'denied':error instanceof WebflowError&&error.kind==='rate_limit'?'rate_limit':'unavailable',...(error instanceof WebflowError?{p_retry:error.retryAfter??60}:{})});
  throw error;
 }
 const finished=await client.rpc('webflow_metadata',{...args,p_action:'finish',p_data:{site:context.site,collections:context.collections,details}});
 if(finished.error||z.object({status:z.string()}).parse(finished.data).status!=='saved')throw new Error('source_changed');
 return details;
}
