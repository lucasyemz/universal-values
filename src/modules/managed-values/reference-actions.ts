"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { getScanSite, loadManagedValue } from "@/modules/scans/service";
import { loadChangeRequest } from "@/modules/scans/change-service";
import { getConnectionReader } from "@/modules/sites/service";
import { bindingSchema, type ManagedBinding } from "./sync-plan";
import { refreshTextReference } from "./reference-refresh";
import { prepareItemSlugs } from "@/modules/scans/slug-service";
import { readInlinePreview } from "@/modules/scans/inline-actions";
import { isCurrentReferenceConflict } from "./reference-eligibility";

const receiptSchema = z.object({id:z.uuid(),baseline:bindingSchema,source:z.string().max(20000),confirmed_at:z.string().nullable(),connection_id:z.uuid(),system_request_id:z.uuid().nullish()});
export type ReferenceState = { error?:string; preview?:{id:string;before:string;after:string}; comparison?:{before:string;after:string}; done?:boolean; obsolete?:boolean };
const unavailable = "Não foi possível revisar a referência. Confira a conexão, conclua operações ativas e atualize a página.";

async function readSource(binding:ManagedBinding, expectedConnection?:string) {
  const site = await getScanSite(binding.site_id);
  if (site.workspace_id !== binding.workspace_id || (expectedConnection && site.connection_id !== expectedConnection)) throw new Error(unavailable);
  const {reader,connection}=await getConnectionReader(site.connection_id,{action:"cms_live",siteId:site.id,workspaceId:site.workspace_id});
  if(connection.workspace_id!==site.workspace_id) throw new Error(unavailable);
  const [sites,collections]=await Promise.all([reader.sites(),reader.collections(site.webflow_site_id)]);
  if(!sites.some(s=>s.id===site.webflow_site_id)||!collections.some(c=>c.id===binding.collection_id)) throw new Error(unavailable);
  const [details,item]=await Promise.all([reader.collection(binding.collection_id),reader.item(binding.collection_id,binding.item_id,binding.locale)]);
  if(details.id!==binding.collection_id || !details.fields.some(f=>f.slug===binding.field_slug&&f.type===binding.field_type) || item.id!==binding.item_id || item.isArchived || (binding.locale&&item.cmsLocaleId!==binding.locale)) throw new Error(unavailable);
  return z.string().max(20000).parse(item.fieldData[binding.field_slug]);
}

export async function previewReference(requestId:string,sourceKey:string):Promise<ReferenceState> {
  const input=z.object({requestId:z.uuid(),sourceKey:z.string().min(1).max(500)}).safeParse({requestId,sourceKey});
  if(!input.success) return {error:unavailable};
  try {
    const {request}=await loadChangeRequest(input.data.requestId);
    if(!request.managed_value_id || !["completed","cancelled"].includes(request.status) || !request.results.some(r=>r.sourceKey===sourceKey&&r.status==="conflict")) return {error:unavailable};
    const view=await loadManagedValue(request.managed_value_id);
    const binding=z.array(bindingSchema).parse(view.bindings).find(b=>b.source_key===sourceKey);
    const original=z.array(bindingSchema).parse(request.managed_snapshot).find(b=>b.id===binding?.id);
    if(view.value.archived_at||!binding||!isCurrentReferenceConflict(original,binding)) return {obsolete:true};
    const after=await readSource(binding);
    try { refreshTextReference(binding,after); }
    catch(error) { return {comparison:{before:binding.source_value,after},error:error instanceof Error?error.message:unavailable}; }
    const {client}=await requireUser();
    const saved=await client.rpc("preview_managed_reference",{p_id:randomUUID(),p_request:request.id,p_binding:binding.id,p_source:after});
    if(saved.error) return {error:unavailable};
    const receipt=receiptSchema.parse(saved.data);
    return {preview:{id:receipt.id,before:receipt.baseline.source_value,after:receipt.source}};
  } catch { return {error:unavailable}; }
}

export async function confirmReference(id:string):Promise<ReferenceState> {
  if(!z.uuid().safeParse(id).success) return {error:unavailable};
  try {
    const {client}=await requireUser();
    const result=await client.rpc("read_managed_reference",{p_id:id});
    if(result.error) return {error:unavailable};
    const receipt=receiptSchema.parse(result.data);
    if(receipt.confirmed_at) return {done:true};
    const source=await readSource(receipt.baseline,receipt.connection_id);
    if(source!==receipt.source) return {error:"O campo mudou novamente no Webflow. Revise a referência outra vez antes de confirmar."};
    const saved=await client.rpc("confirm_managed_reference",{p_id:id,p_source:source});
    if(saved.error) return {error:"A referência expirou ou mudou, ou existe uma operação ativa. Revise novamente após concluir as operações."};
    return {done:true};
  } catch { return {error:unavailable}; }
}

export async function prepareSystemReference(id:string,referenceId:string) {
  const parsed=z.object({id:z.uuid(),referenceId:z.uuid()}).safeParse({id,referenceId});
  if(!parsed.success)return {ok:false as const,message:unavailable};
  try {
    const {client}=await requireUser();
    const result=await client.rpc("read_managed_reference",{p_id:referenceId});
    if(result.error)return {ok:false as const,message:unavailable};
    const receipt=receiptSchema.parse(result.data);
    // Reread against the exact comparison; never authorize an unseen field.
    const source=await readSource(receipt.baseline,receipt.connection_id);
    if(source!==receipt.source)return {ok:false as const,message:"O campo mudou novamente no Webflow. Revise a referência outra vez antes de confirmar."};
    refreshTextReference(receipt.baseline,source);
    const operationId=receipt.system_request_id??id;
    const prepared=await client.rpc("preview_managed_reference_system",{p_id:operationId,p_reference:referenceId});
    if(prepared.error)return {ok:false as const,message:unavailable};
    await prepareItemSlugs(operationId);
    return readInlinePreview(operationId);
  }catch{return {ok:false as const,message:unavailable};}
}
