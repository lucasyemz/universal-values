"use server";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";
import { managedValueSchema } from "@/modules/managed-values/schema";
import { getConnectionReader } from "@/modules/sites/service";
import { kickConfirmedOperation } from "@/modules/sync-worker/kick";
import { getScan, getScanSite } from "./service";
import { occurrenceSchema, valuePreviewInputSchema, valuePreviewSchema } from "./schema";
import { sameField } from "./change-plan";
import { variablePlan, variablePreview } from "./variable-preview";
import { isItemName, slugUpdatesSchema, suggestItemSlug } from "./item-slug";

const intentSchema=z.object({connection_id:z.uuid(),after_value:managedValueSchema,slug_updates:slugUpdatesSchema,confirmed_at:z.string().nullable()});
async function readIntent(id:string) {
  const {client}=await requireUser();
  const saved=await client.from("managed_value_previews").select("*").eq("id",id).single();
  if(saved.error)throw new Error("Preview unavailable");
  const value=valuePreviewSchema.parse(saved.data), scan=await getScan(value.scan_id);
  const intent=await client.from("scan_variable_previews").select("*").eq("id",id).single();
  if(intent.error)throw new Error("Preview unavailable");
  const data=intentSchema.parse(intent.data);
  const found=await client.from("scan_occurrences").select("*").eq("scan_id",value.scan_id).in("id",value.occurrence_ids).order("id");
  if(found.error || found.data.length!==value.occurrence_ids.length)throw new Error("Occurrences unavailable");
  const rows=z.array(occurrenceSchema).parse(found.data);
  return {value,data,preview:variablePreview({id,workspace:scan.workspace_id,name:value.name,connectionId:data.connection_id,expiresAt:value.expires_at,rows,after:data.after_value,slugs:data.slug_updates})};
}

export async function prepareVariableChanges(input:unknown) {
  const parsed=valuePreviewInputSchema.extend({after:managedValueSchema}).safeParse(input);
  if(!parsed.success)return {ok:false as const,message:"Revise o nome, o valor e as ocorrências da variável."};
  try {
    const {id,scanId,name,occurrenceIds,after}=parsed.data;
    const scan=await getScan(scanId), site=await getScanSite(scan.site_id);
    const {client}=await requireUser();
    // A retry must reuse its frozen slug evidence, never silently refresh it.
    const existing=await client.from("scan_variable_previews").select("id").eq("id",id).maybeSingle();
    if(existing.error)throw new Error("Migration unavailable");
    if(existing.data) {
      const saved=await readIntent(id);
      if(saved.value.scan_id!==scanId || saved.value.name!==name || JSON.stringify([...saved.value.occurrence_ids].sort())!==JSON.stringify([...occurrenceIds].sort()) || !sameField(saved.data.after_value,after))throw new Error("Operation key conflict");
      if(saved.data.confirmed_at || Date.parse(saved.value.expires_at)<=Date.now())return {ok:false as const,refresh:true,message:"A prévia expirou ou já foi confirmada. Atualize os dados antes de aplicar."};
      return {ok:true as const,preview:saved.preview};
    }
    const found=await client.from("scan_occurrences").select("*").eq("scan_id",scanId).in("id",occurrenceIds).order("id");
    if(found.error || found.data.length!==occurrenceIds.length)throw new Error("Occurrences unavailable");
    const rows=z.array(occurrenceSchema).parse(found.data);
    const plan=variablePlan(id,scan.workspace_id,rows,after);
    const slugs:z.infer<typeof slugUpdatesSchema>={};
    const names=plan.filter(isItemName);
    if(names.length) {
      const {reader}=await getConnectionReader(site.connection_id);
      for(const field of names) {
        const o=field.occurrence,item=await reader.item(o.collection_id,o.item_id,o.locale);
        if(item.id!==o.item_id || (o.locale && item.cmsLocaleId!==o.locale) || item.isArchived || typeof item.fieldData.slug!=="string" || typeof field.after!=="string")throw new Error("Invalid slug source");
        slugs[field.sourceKey]={before:item.fieldData.slug,after:field.before===field.after?item.fieldData.slug:suggestItemSlug(field.after)};
      }
    }
    const result=await client.rpc("preview_scan_variable",{p_id:id,p_scan_id:scanId,p_name:name,p_occurrence_ids:occurrenceIds,p_after:after,p_connection_id:site.connection_id,p_slugs:slugUpdatesSchema.parse(slugs)});
    if(result.error)throw new Error("Preview unavailable");
    return {ok:true as const,preview:(await readIntent(id)).preview};
  }catch(error){unstable_rethrow(error);return {ok:false as const,message:"Não foi possível preparar a variável. Confira a seleção, os vínculos e a migration de criação com aplicação."};}
}
export async function confirmVariableChanges(input:unknown) {
  const parsed=z.strictObject({id:z.uuid(),digest:z.string().regex(/^[a-f0-9]{64}$/),confirmed:z.literal(true)}).safeParse(input);
  if(!parsed.success)return {ok:false as const,message:"Confirme a prévia exibida antes de aplicar."};
  try {
    const saved=await readIntent(parsed.data.id);
    if(saved.preview.digest!==parsed.data.digest || (!saved.data.confirmed_at && Date.parse(saved.value.expires_at)<=Date.now()))return {ok:false as const,refresh:true,message:"A prévia está desatualizada. Confira os valores atualizados antes de aplicar."};
    const {client}=await requireUser();
    const result=await client.rpc("confirm_scan_variable",{p_id:parsed.data.id});
    if(result.error)return {ok:false as const,refresh:true,message:"Não foi possível criar e aplicar a variável. A conexão, a cota ou os vínculos podem ter mudado. Nenhuma criação parcial foi confirmada."};
    await kickConfirmedOperation(parsed.data.id);
    revalidatePath("/dashboard/scans/"+saved.value.scan_id);
    revalidatePath("/dashboard/sites/"+saved.value.site_id+"/scans");
    return {ok:true as const,id:parsed.data.id};
  }catch(error){unstable_rethrow(error);return {ok:false as const,message:"Não foi possível confirmar a operação. Tente novamente para recuperar a mesma solicitação."};}
}
