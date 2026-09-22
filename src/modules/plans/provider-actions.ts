"use server";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { getPlanUsage } from "./service";
import { getConnectionReader } from "@/modules/sites/service";
import { unstable_rethrow } from "next/navigation";
export async function checkWebflowAllowance(siteId: string) {
  if (!z.uuid().safeParse(siteId).success) return null;
  const usage = await getPlanUsage();
  if (usage.plan !== "admin") return null;
  const { client } = await requireUser();
  const { data, error } = await client.from("sites").select("connection_id,webflow_site_id").eq("id", siteId).maybeSingle();
  if (error || !data) return null;
  try {
    const { reader } = await getConnectionReader(data.connection_id);
    const quota = await reader.rateLimit(data.webflow_site_id);
    return quota ? { ...quota, checkedAt: new Date().toISOString() } : null;
  } catch (error) { unstable_rethrow(error); return null; }
}
