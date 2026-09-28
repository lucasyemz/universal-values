import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("newScan");
}

import { loadRepeatScan, repeatDigest } from "@/modules/scans/repeat-service";
import { RepeatScan } from "@/components/sites/repeat-scan";
import { siteLink } from "@/modules/routes/links";
import { getPlanUsage } from "@/modules/plans/service";
import { getText } from "@/i18n/server";
import { readMetadata } from "@/modules/sites/metadata-service";
import { MetadataRefresh } from "@/components/sites/metadata-refresh";
import { randomUUID } from "node:crypto";
import { SitePage } from "@/components/sites/site-page";
import { Notice } from "@/components/ui";
import { FreshLink } from "@/components/ui/fresh-link";
import { NewScanWizard } from "@/components/sites/new-scan-wizard";
import { getScanSite } from "@/modules/scans/service";

export default async function NewScanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; q?: string; repeat?: string }> }) {
  const t = await getText();

  const { id }=await params, { error, q, repeat }=await searchParams,site=await getScanSite(id);
  if (repeat) {
    const scan = await loadRepeatScan(id, repeat), base = await siteLink(id), usage = await getPlanUsage();
    return <SitePage site={site} title={t("Repetir scan")} description={t("Confira a configuração salva antes de iniciar outra leitura.")}><RepeatScan scan={scan} number={repeat} operationId={randomUUID()} digest={repeatDigest(scan)} newScanHref={base + "/scans/new"} itemLimit={usage.plan === "admin" ? 500 : 100} /></SitePage>;
  }
  const base = await siteLink(id);
  const metadata=await readMetadata(id,"collections");
  const collections=metadata.fresh?metadata.data?.collections:null;
  return <SitePage site={site} title={t("Novo scan")} description={t("Escolha as coleções e o que deseja encontrar. Clique em Pesquisar para iniciar.")}>
    <div className="mb-5"><FreshLink href={`/dashboard/sites/${id}/scans`}>{t("← Voltar aos scans")}</FreshLink></div>
    {error && <Notice tone={error==='active'?'warning':'danger'} title={t(error==='active'?"Já existe um scan ativo":"Não foi possível iniciar o scan")}>
      {t(error==='active'?"Já existe um scan em andamento ou pausado neste site. Conclua ou cancele esse scan antes de iniciar outro.":error==='scope'?"Selecione de 1 a 20 coleções e pelo menos um tipo ou texto específico.":error==='provider'?"Confira a conexão com o Webflow e tente iniciar o scan novamente.":"Não foi possível iniciar a pesquisa. Atualize a página e tente novamente.")}
      {error==='active' && <div className="mt-3"><FreshLink href={base+'/scans'}>{t("Ver scans do site")}</FreshLink></div>}
    </Notice>}
    <MetadataRefresh siteId={id} fetchedAt={metadata.entry?.fetchedAt}/>
    {!collections ? <Notice tone="danger" title={t(metadata.denied ? "Conexão indisponível" : "Atualize as coleções para continuar")}>{t(metadata.denied ? "Confira as permissões nas configurações do Webflow." : "A estrutura salva está ausente ou expirou. Atualize quando quiser preparar um scan.")}</Notice> : <NewScanWizard siteId={id} operationId={randomUUID()} collections={collections} staticHref={base + "/static"} initialQuery={q?.slice(0,200)} />}

  </SitePage>;
}
