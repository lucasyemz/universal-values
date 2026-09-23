import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("newScan");
}

import { loadRepeatScan, repeatDigest } from "@/modules/scans/repeat-service";
import { RepeatScan } from "@/components/sites/repeat-scan";
import { siteLink } from "@/modules/routes/links";
import { getPlanUsage } from "@/modules/plans/service";
import { getText } from "@/i18n/server";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { SitePage } from "@/components/sites/site-page";
import { Notice } from "@/components/ui";
import { FreshLink } from "@/components/ui/fresh-link";
import { NewScanWizard } from "@/components/sites/new-scan-wizard";
import { getScanSite, loadScanCollections } from "@/modules/scans/service";

export default async function NewScanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; q?: string; repeat?: string }> }) {
  const t = await getText();

  const { id }=await params, { error, q, repeat }=await searchParams,site=await getScanSite(id);
  if (repeat) {
    const scan = await loadRepeatScan(id, repeat), base = await siteLink(id), usage = await getPlanUsage();
    return <SitePage site={site} title={t("Repetir scan")} description={t("Confira a configuração salva antes de iniciar outra leitura.")}><RepeatScan scan={scan} number={repeat} operationId={randomUUID()} digest={repeatDigest(scan)} newScanHref={base + "/scans/new"} itemLimit={usage.plan === "admin" ? 500 : 100} /></SitePage>;
  }
  const base = await siteLink(id);
  const collections=await loadScanCollections(id).catch(()=>null);
  return <SitePage site={site} title={t("Novo scan")} description={t("Escolha onde buscar e o que encontrar. Você revisará o escopo antes de iniciar.")}>
    <div className="mb-5"><FreshLink href={`/dashboard/sites/${id}/scans`}>{t("← Voltar aos scans")}</FreshLink></div>
    {error && <Notice tone="danger" title={t("Não foi possível preparar o scan")}>{error==='scope'?t("Selecione de 1 a 20 coleções e pelo menos um tipo ou texto específico."):t("Confira a conexão com o Webflow e tente preparar a prévia novamente.")}</Notice>}
    {collections===null ? <Notice tone="danger" title={t("Não foi possível ler as coleções")}>{t("A configuração do scan depende da conexão Webflow.")} <FreshLink href={`/dashboard/sites/${id}/scans/new`}>{t("Tentar novamente")}</FreshLink>  {t("ou")} <Link className="underline" href={`/dashboard/connections/${site.connection_id}`}>{t("conferir conexão")}</Link>.</Notice> : <NewScanWizard siteId={id} operationId={randomUUID()} collections={collections} staticHref={base + "/static"} initialQuery={q?.slice(0,200)} />}
  </SitePage>;
}
