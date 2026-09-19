"use server";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { activityInput, changeRow, scanRow, changeActivity, scanActivity } from "./model";

export async function getActivity(input: unknown) {
  const parsed = activityInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Consulta de processos inválida." };
  try {
    const { client, user } = await requireUser();
    const changesFilter = "status.eq.confirmed" + (parsed.data.changes.length ? `,id.in.(${parsed.data.changes.join(",")})` : "");
    const scansFilter = "status.in.(running,paused)" + (parsed.data.scans.length ? `,id.in.(${parsed.data.scans.join(",")})` : "");
    const [changes, scans, health] = await Promise.all([
      client.from("cms_change_requests").select("id,site_id,status,cursor,total,background_paused,managed_value_id,results").eq("actor_id", user.id).or(changesFilter).order("created_at", { ascending: false }).limit(50),
      client.from("cms_scans").select("id,site_id,status,items_read,occurrences_count").eq("actor_id", user.id).or(scansFilter).order("created_at", { ascending: false }).limit(50),
      client.rpc("cms_worker_last_seen", {}),
    ]);
    if (changes.error || scans.error) throw new Error("Activity unavailable");
    const changeRows = z.array(changeRow).parse(changes.data);
    const scanRows = z.array(scanRow).parse(scans.data);
    const siteIds = [...new Set([...changeRows, ...scanRows].map(row => row.site_id))];
    const sites = siteIds.length ? await client.from("sites").select("id,display_name").in("id", siteIds) : { data: [], error: null };
    if (sites.error) throw new Error("Sites unavailable");
    const names = new Map(sites.data?.map(site => [site.id, site.display_name]));
    const items = [...changeRows.map(row => changeActivity(row, names.get(row.site_id) ?? "Site")), ...scanRows.map(row => scanActivity(row, names.get(row.site_id) ?? "Site"))];
    const worker = health.error ? "unknown" : health.data && Date.now() - Date.parse(health.data) < 180000 ? "online" : "offline";
    return { ok: true as const, items, worker, limited: changeRows.length === 50 || scanRows.length === 50 };
  } catch { return { ok: false as const, message: "Não foi possível atualizar os processos. Tentaremos novamente automaticamente." }; }
}
