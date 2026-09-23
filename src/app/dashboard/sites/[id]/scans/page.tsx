import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("scans");
}

import { ScanHistoryList } from "@/components/scans/history-list";
import { siteLink } from "@/modules/routes/links";


import { getText } from "@/i18n/server";


import { SitePage, SitePagination } from "@/components/sites/site-page";
import { LegacySiteSection } from "@/components/sites/legacy-site-section";
import { EmptyState } from "@/components/ui";

import { siteScansPage } from "@/modules/sites/page-service";
import { sitePageNumber } from "@/modules/sites/presentation";


export default async function SiteScansPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const t = await getText();

  const { id } = await params; const page = sitePageNumber((await searchParams).page);
  const view = await siteScansPage(id,page);
  const base = await siteLink(id);
  return <SitePage site={view.site} title={t("Scans")} description={t("Encontre conteúdo repetido e revise os resultados das suas buscas.")} newScan newScanHref={base + "/scans/new"}>
    <LegacySiteSection siteId={id} />
    {!view.scans.length ? <EmptyState title={page===1 ? t("Nenhum scan ainda") : t("Nenhum scan nesta página")} description={t("Prepare um scan para encontrar conteúdo repetido neste site.")} /> : <ScanHistoryList key={page} scans={view.scans} links={view.scanLinks} counts={view.reviewCounts} />}
    <SitePagination page={page} total={view.total} base={base + "/scans"} />
  </SitePage>;
}
