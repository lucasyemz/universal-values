import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { WebflowError } from "@/connectors/webflow/client";
import { siteSchema,collectionSchema,collectionDetailsSchema,webflowIdSchema } from "@/connectors/webflow/schemas";
import { getConnectionReader } from "./service";
import { linkedSiteSchema } from "./schema";
export const METADATA_TTL_MS=15*60*1000;
export const metadataBundleSchema=z.object({site:siteSchema,collections:z.array(collectionSchema).max(1000).optional(),details:collectionDetailsSchema.optional()});
const snapshotSchema=z.object({site:linkedSiteSchema,actorId:z.uuid(),generation:z.uuid(),status:z.enum(['ready','denied']),entry:z.object({data:z.unknown().nullable(),fetchedAt:z.string().nullable(),error:z.enum(['denied','rate_limit','unavailable']).nullable(),retryAt:z.string().nullable()}).nullable()});
export type MetadataKind='site'|'collections'|'schema';
export async function readMetadata(siteId:string,kind:MetadataKind='site',collection='') {
 z.uuid().parse(siteId);if(kind==='schema')webflowIdSchema.parse(collection);
 const {client}=await requireUser();
 const result=await client.rpc('webflow_metadata',{p_site:siteId,p_kind:kind,p_collection:collection});
 if(result.error)throw new Error('Saved Webflow metadata unavailable.');
 const snapshot=snapshotSchema.parse(result.data);
 const parsed=metadataBundleSchema.safeParse(snapshot.entry?.data);
 const denied=snapshot.status==='denied'||snapshot.entry?.error==='denied';
 const data=!denied&&parsed.success&&parsed.data.site.id===snapshot.site.webflow_site_id&&(kind!=='schema'||parsed.data.details?.id===collection)?parsed.data:null;
 const fresh=!!data&&!!snapshot.entry?.fetchedAt&&Date.now()-Date.parse(snapshot.entry.fetchedAt)<METADATA_TTL_MS;
 return {...snapshot,data,fresh,denied};
}
// Only pending work is shared. Never a resolved credential/result cache or authorization cache.
const flights=new Map<string,Promise<void>>();
export async function refreshMetadata(siteId:string,kind:MetadataKind='collections',collection='') {
 const before=await readMetadata(siteId,kind,collection); // Every caller independently checks current ownership.
 if(before.status==='denied')throw new Error('Webflow connection unavailable. Reconnect in settings.');
 const key=JSON.stringify([before.actorId,before.site.workspace_id,siteId,before.site.connection_id,before.generation,kind,collection]);
 const existing=flights.get(key);
 if(existing){await existing;return readMetadata(siteId,kind,collection);}
 if(flights.size>=100)throw new Error('Metadata refresh busy. Try again shortly.');
 const pending=performRefresh(before,kind,collection);
 flights.set(key,pending);
 try{await pending;}finally{flights.delete(key);}
 return readMetadata(siteId,kind,collection);
}
async function performRefresh(before:Awaited<ReturnType<typeof readMetadata>>,kind:MetadataKind,collection:string) {
 const {client}=await requireUser();const lease=randomUUID();
 const args={p_site:before.site.id,p_kind:kind,p_collection:collection,p_generation:before.generation,p_lease:lease};
 const claim=await client.rpc('webflow_metadata',{...args,p_action:'claim'});
 if(claim.error)throw new Error('Metadata scope changed. Reload the page.');
 const state=z.object({status:z.string(),retryAt:z.string().optional()}).parse(claim.data);
 if(state.status==='cooldown')throw new WebflowError('rate_limit',Math.max(5,Math.ceil((Date.parse(state.retryAt!)-Date.now())/1000)));
 if(state.status!=='claimed')throw new Error(state.status==='busy'?'Metadata refresh already in progress. Try again shortly.':'Metadata scope changed. Reload the page.');
 let data:z.infer<typeof metadataBundleSchema>;
 try{
  const {reader,connection}=await getConnectionReader(before.site.connection_id,{action:'metadata_refresh',siteId:before.site.id,workspaceId:before.site.workspace_id});
  if(connection.id!==before.site.connection_id||connection.workspace_id!==before.site.workspace_id||connection.actor_id!==before.actorId)throw new WebflowError('forbidden');
  const remote=(await reader.sites()).find(s=>s.id===before.site.webflow_site_id);
  if(!remote)throw new WebflowError('forbidden');
  data={site:remote};
  if(kind!=='site'){
   data.collections=await reader.collections(remote.id);
   if(kind==='schema'){
    if(!data.collections.some(c=>c.id===collection))throw new WebflowError('forbidden');
    data.details=await reader.collection(collection);
    if(data.details.id!==collection)throw new WebflowError('invalid_response');
   }
  }
  data=metadataBundleSchema.parse(data);
 }catch(error){
  const type=error instanceof WebflowError && ['unauthorized','forbidden'].includes(error.kind)?'denied':error instanceof WebflowError&&error.kind==='rate_limit'?'rate_limit':'unavailable';
  await client.rpc('webflow_metadata',{...args,p_action:'finish',p_error:type,...(error instanceof WebflowError&&error.retryAfter!==undefined?{p_retry:Math.min(86400,Math.max(5,Math.ceil(error.retryAfter)))}:{})});
  throw error;
 }
 const saved=await client.rpc('webflow_metadata',{...args,p_action:'finish',p_data:data});
 if(saved.error||z.object({status:z.string()}).parse(saved.data).status!=='saved')throw new Error('Metadata scope changed. Reload the page.');
}
