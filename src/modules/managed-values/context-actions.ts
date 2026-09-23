"use server";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { savedValueSchema } from "@/modules/scans/schema";
import { resourceLink } from "@/modules/routes/links";
const contextSchema=z.object({value:savedValueSchema,disabled:z.boolean(),total:z.number().int().nonnegative(),page:z.number().int().positive(),hasMore:z.boolean(),sources:z.array(z.object({id:z.uuid(),field:z.string(),collection:z.string(),item:z.string(),locale:z.string(),value:z.string(),uncertain:z.boolean(),verifiedAt:z.string().nullable()})).max(10)});
export async function loadManagedContext(input: unknown) {
  const parsed = z.strictObject({ siteId: z.uuid(), valueId: z.uuid(), page: z.number().int().min(1).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false as const };
  try {
    const {client}=await requireUser();
    const response=await client.rpc("managed_context_page",{p_id:parsed.data.valueId,p_site:parsed.data.siteId,p_page:parsed.data.page});
    if(response.error) return {ok:false as const};
    const view=contextSchema.parse(response.data);
    if(view.value.site_id!==parsed.data.siteId || view.value.id!==parsed.data.valueId)return {ok:false as const};
    return {ok:true as const,...view,href:await resourceLink("managed-values",view.value.id)};
  } catch { return { ok: false as const }; }
}
