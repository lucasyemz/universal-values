import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { requireWorkspaceOwner } from "@/modules/sites/service";
import { factsPreviewSchema, factsVersionSchema } from "./schema";

export async function factsSite(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, user } = await requireUser();
  const result = await client.from("sites").select("id,workspace_id,display_name").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar o site.");
  if (!result.data) notFound();
  await requireWorkspaceOwner(result.data.workspace_id);
  return { client, user, site: result.data };
}

export async function loadFacts(siteId: string, archived = false) {
  const { client, site } = await factsSite(siteId);
  const previewQuery = client.from("global_fact_previews").select("*").eq("site_id", siteId).is("confirmed_version", null);
  const [versions, previews] = await Promise.all([
    client.from("global_fact_versions").select("*").eq("site_id", siteId).order("version", { ascending: false }).limit(20),
    (archived ? previewQuery.not("archived_at", "is", null) : previewQuery.is("archived_at", null)).order("created_at", { ascending: false }).limit(20),
  ]);
  if ([versions.error, previews.error].some(error => error?.code === "PGRST205" || error?.code === "42P01")) {
    return { site, missingMigration: "010", versions: [], previews: [] };
  }
  if ([versions.error, previews.error].some(error => error?.code === "42703" || error?.code === "PGRST204")) return { site, missingMigration: "011", versions: [], previews: [] };
  if (versions.error || previews.error) throw new Error("Não foi possível carregar os fatos. Tente novamente.");
  const parsedVersions = z.array(factsVersionSchema).parse(versions.data);
  const currentVersion = parsedVersions[0]?.version ?? 0;
  const now = Date.now();
  const parsedPreviews = z.array(factsPreviewSchema).parse(previews.data).map(preview => ({
    ...preview,
    statusLabel: preview.archived_at ? "Arquivada" : preview.base_version !== currentVersion ? "Desatualizada — abra para arquivar" : new Date(preview.expires_at).getTime() <= now ? "Expirada — abra para arquivar" : "Aguardando confirmação",
  }));
  return { site, missingMigration: false, versions: parsedVersions, previews: parsedPreviews };
}

export async function loadFactsPreview(siteId: string, id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, site, user } = await factsSite(siteId);
  const row = await client.from("global_fact_previews").select("*").eq("id", id).eq("site_id", siteId).eq("actor_id", user.id).maybeSingle();
  if (row.error) throw new Error("Não foi possível carregar a prévia.");
  if (!row.data) notFound();
  const preview = factsPreviewSchema.parse(row.data);
  const [base, latest] = await Promise.all([
    client.from("global_fact_versions").select("*").eq("site_id", siteId).eq("version", preview.base_version).maybeSingle(),
    client.from("global_fact_versions").select("version").eq("site_id", siteId).order("version", { ascending: false }).limit(1),
  ]);
  if (base.error || latest.error) throw new Error("Não foi possível conferir a versão de referência.");
  if (preview.base_version > 0 && !base.data) throw new Error("Versão de referência indisponível.");
  return { site, preview, before: base.data ? factsVersionSchema.parse(base.data).facts : null,
    expired: new Date(preview.expires_at).getTime() <= Date.now(), stale: (latest.data[0]?.version ?? 0) !== preview.base_version };
}

export async function loadFactsVersion(siteId: string, version: string) {
  if (!/^[1-9][0-9]{0,8}$/.test(version)) notFound();
  const { client, site } = await factsSite(siteId);
  const result = await client.from("global_fact_versions").select("*").eq("site_id", siteId).eq("version", Number(version)).maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar a versão.");
  if (!result.data) notFound();
  return { site, version: factsVersionSchema.parse(result.data) };
}
