import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { getScan, getScanSite } from "./service";
import { planSchema, type Scan } from "./schema";
import { scanStartError } from "./start-error";

export function repeatPlan(scan: Scan) {
  if (!["completed", "limited", "cancelled"].includes(scan.status)) throw new Error("Scan indisponível para repetir.");
  return planSchema.min(1).parse(scan.plan);
}
export function repeatDigest(scan: Scan) {
  return createHash("sha256").update(JSON.stringify({ site: scan.site_id, connection: scan.connection_id, plan: repeatPlan(scan) })).digest("hex");
}
export async function loadRepeatScan(siteId: string, number: string) {
  const parsed = z.string().regex(/^[1-9][0-9]{0,14}$/).safeParse(number);
  if (!parsed.success) notFound();
  await getScanSite(siteId);
  const { client, user } = await requireUser();
  const row = await client.from("dashboard_resource_routes").select("resource_id").eq("site_id", siteId).eq("account_id", user.id).eq("kind", "scans").eq("number", Number(parsed.data)).maybeSingle();
  if (row.error || !row.data) notFound();
  const scan = await getScan(row.data.resource_id);
  if (scan.site_id !== siteId || scan.actor_id !== user.id) notFound();
  repeatPlan(scan);
  return scan;
}

export async function confirmRepeat(input: { id: string; scanId: string; digest: string }) {
  const scan = await getScan(input.scanId);
  if (repeatDigest(scan) !== input.digest) throw new Error("A configuração mudou. Atualize o resumo antes de confirmar.");
  const site = await getScanSite(scan.site_id);
  if (site.connection_id !== scan.connection_id) throw new Error("A conexão mudou. Prepare um novo scan.");
  const { client } = await requireUser();
  // Same immutable preview, confirmation, quota, audit and idempotency gateways.
  // Current remote authorization/collection scope is checked by readScanBatch, after confirmation.
  const confirmed = await client.rpc("repeat_cms_scan", { p_id: input.id, p_scan_id: scan.id });
  if (confirmed.error?.message === "Wait for scan changes to finish") throw new Error("Aguarde as alterações deste scan terminarem antes de criar outra versão.");
  if (confirmed.error?.message === "Historical scan is read-only") throw new Error("Esta versão é somente leitura. Abra a versão mais recente.");
  if (confirmed.error) throw new Error(scanStartError(confirmed.error)==='active' ? "Já existe um scan em andamento ou pausado neste site. Conclua ou cancele esse scan antes de iniciar outro." : "Não foi possível confirmar. Confira seu limite e se já existe um scan ativo.");
  return input.id;
}
