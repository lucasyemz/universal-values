import { ScanCollectionCell } from "@/components/scans/collection-cell";
import { getText } from "@/i18n/server";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SitePage, SitePagination } from "@/components/sites/site-page";
import { LegacySiteSection } from "@/components/sites/legacy-site-section";
import { DataTable, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { siteScansPage } from "@/modules/sites/page-service";
import { sitePageNumber, siteDate } from "@/modules/sites/presentation";
import { detectionLabels, searchedScanTypes } from "@/modules/scans/schema";

export default async function SiteScansPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const t = await getText();

  const { id } = await params; const page = sitePageNumber((await searchParams).page);
  const view = await siteScansPage(id,page);
  return <SitePage site={view.site} title={t("Scans")} description={t("Encontre conteúdo repetido e revise os resultados das suas buscas.")} newScan>
    <LegacySiteSection siteId={id} />
    {!view.scans.length ? <EmptyState title={page===1 ? t("Nenhum scan ainda") : t("Nenhum scan nesta página")} description={t("Prepare um scan para encontrar conteúdo repetido neste site.")} /> : <DataTable label={t("Histórico de scans")}><thead><tr><th>{t("Busca")}</th><th>{t("Iniciado em")}</th><th>{t("Coleções do CMS")}</th><th>{t("Revisão")}</th><th>Status</th><th><span className="sr-only">{t("Abrir scan")}</span></th></tr></thead><tbody>{view.scans.map(scan => <tr key={scan.id} className="relative hover:bg-subtle/60 focus-within:bg-subtle"><td className="min-w-48 max-w-md"><Link className="font-medium after:absolute after:inset-0" href={view.scanLinks[scan.id]!}>{scan.plan[0]?.searchText ? `“${scan.plan[0].searchText}”` : searchedScanTypes(scan).map(type=>t(type === "text" && scan.plan.some(entry => entry.placeholders) ? "Textos de exemplo" : detectionLabels[type])).join(", ")}</Link>{scan.plan[0]?.searchText && <p className="mt-1 text-xs text-muted">{searchedScanTypes(scan).map(type=>t(type === "text" && scan.plan.some(entry => entry.placeholders) ? "Textos de exemplo" : detectionLabels[type])).join(", ")}</p>}</td><td className="whitespace-nowrap text-sm tabular-nums">{siteDate(scan.created_at, t.dateLocale)}</td><td className="min-w-48 max-w-xs"><ScanCollectionCell scan={scan} href={view.scanLinks[scan.id]!} /></td><td className="whitespace-nowrap text-sm tabular-nums">{view.reviewCounts[scan.id] ? <div className="flex flex-col gap-1"><Link className="relative z-10 text-accent hover:underline" href={view.scanLinks[scan.id] + "?filter=pending"}>{t("Pendentes")} ({view.reviewCounts[scan.id]!.pending})</Link><Link className="relative z-10 text-muted hover:underline" href={view.scanLinks[scan.id] + "?filter=reviewed"}>{t("Revisados")} ({view.reviewCounts[scan.id]!.reviewed})</Link></div> : <span className="text-muted">—</span>}</td><td><StatusBadge status={scan.status} /></td><td><ArrowUpRight size={16} aria-hidden="true" /></td></tr>)}</tbody></DataTable>}
    <SitePagination page={page} total={view.total} base={`/dashboard/sites/${id}/scans`} />
  </SitePage>;
}
