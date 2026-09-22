import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
export const planUsageSchema = z.object({ plan: z.enum(["free", "admin"]), sites: z.number().int().nonnegative(), scans: z.number().int().nonnegative(), fields: z.number().int().nonnegative(), resetsAt: z.string(), paused: z.boolean(), canSwitch: z.boolean(), previews: z.number().int().nonnegative(), reads: z.number().int().nonnegative(), requests: z.number().int().nonnegative(), active: z.number().int().nonnegative(), trackingSince: z.string().optional(), capacity: z.array(z.object({ metric: z.enum(["accounts", "scans", "fields", "reads", "storage"]), used: z.number().nonnegative(), limit: z.number().positive() })).optional() });
export const getPlanUsage = cache(async () => {
  const { client } = await requireUser();
  const { data, error } = await client.rpc("account_plan_usage", {});
  if (error) throw new Error("Não foi possível consultar o plano. Confira a migration 017.");
  return planUsageSchema.parse(data);
});
