import "server-only";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
export async function workspaceOverviewCounts() {
  const {client}=await requireUser();
  const {data,error}=await client.rpc("workspace_overview_counts");
  // Do not invent zero counts while the new migration is awaiting deployment.
  if(error)return [];
  return z.array(z.object({id:z.uuid(),sites:z.number().int().nonnegative(),scans:z.number().int().nonnegative(),variables:z.number().int().nonnegative()})).parse(data);
}
