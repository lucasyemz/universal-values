"use server";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { loadChangeRequest } from "./change-service";
import { prepareItemSlugs } from "./slug-service";
import { readInlinePreview } from "./inline-actions";

export async function prepareInlineRevert(input: unknown) {
  const parsed = z.strictObject({id:z.uuid(), originalId:z.uuid(), sources:z.array(z.string().min(1)).min(1).max(1000)}).safeParse(input);
  if (!parsed.success) return {ok:false as const,message:"Seleção de reversão inválida."};
  try {
    const {request}=await loadChangeRequest(parsed.data.originalId);
    if (request.managed_value_id || request.reverts_request_id || !["completed","cancelled"].includes(request.status) || parsed.data.sources.some(source=>!request.results.some(r=>r.sourceKey===source && r.status==="applied" && r.actual!==undefined)))
      return {ok:false as const,message:"A reversão não está disponível para estes campos."};
    const {client}=await requireUser();
    const result=await client.rpc("preview_cms_revert",{p_id:parsed.data.id,p_original_id:request.id,p_sources:[...new Set(parsed.data.sources)]});
    if(result.error)return {ok:false as const,message:"Não foi possível preparar a reversão."};
    await prepareItemSlugs(parsed.data.id);
    return readInlinePreview(parsed.data.id);
  } catch {return {ok:false as const,message:"Não foi possível preparar a reversão."};}
}
