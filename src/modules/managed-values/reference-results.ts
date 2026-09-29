import "server-only";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { loadManagedValue } from "@/modules/scans/service";
import { bindingSchema } from "./sync-plan";
import { referenceConflictState } from "./reference-eligibility";

export async function currentReferenceSources(valueId:string,snapshot:unknown) {
  const view=await loadManagedValue(valueId);
  const current=new Map(z.array(bindingSchema).parse(view.bindings).map(binding=>[binding.id,binding]));
  return new Map(z.array(bindingSchema).parse(snapshot).map(binding=>[binding.source_key,referenceConflictState(binding,current.get(binding.id),!!view.value.archived_at)]));
}

const resultsSchema=z.array(z.object({sourceKey:z.string(),source:z.string().max(20000).nullable(),confirmedAt:z.string(),status:z.enum(["reference","pending","applied"]),operationId:z.uuid().nullable()})).max(1000);
export async function loadReferenceResults(requestId:string) {
  const {client}=await requireUser();
  const result=await client.rpc("managed_reference_results",{p_request:z.uuid().parse(requestId)});
  if(result.error) {
    if(["42883","PGRST202"].includes(result.error.code)) return {missing:true,bySource:new Map<string,z.infer<typeof resultsSchema>[number]>()};
    throw new Error("Não foi possível carregar as resoluções desta operação.");
  }
  return {missing:false,bySource:new Map(resultsSchema.parse(result.data).map(row=>[row.sourceKey,row]))};
}
