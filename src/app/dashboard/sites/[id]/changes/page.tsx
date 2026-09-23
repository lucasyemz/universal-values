import { siteLink } from "@/modules/routes/links";
import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("changes");
}

import { TabLink } from "@/components/ui/tab-link";
import { getText } from "@/i18n/server";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SitePage, SitePagination } from "@/components/sites/site-page";
import { DataTable, EmptyState, StatusBadge } from "@/components/ui";
import { siteChangesPage } from "@/modules/sites/page-service";
import { sitePageNumber, siteDate, changeFilterSchema } from "@/modules/sites/presentation";
export default async function ChangesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; filter?: string; cursor?:string; direction?:string }> }) {
  const t = await getText();

  const { id }=await params, query=await searchParams, page=sitePageNumber(query.page), filter=changeFilterSchema.catch('all').parse(query.filter);
  const view=await siteChangesPage(id,page,filter,query.cursor,query.direction==="previous"),base=(await siteLink(id))+"/changes";
  return <SitePage site={view.site} title={t("Alterações")} description={t("Consulte prévias e operações do CMS e das páginas estáticas.")}>
    <nav className="ui-tabs mb-6" aria-label={t("Filtrar alterações")}>{([['all',t("Todas")],['cms','CMS'],['static',t("Páginas estáticas")],['attention',t("Precisam de atenção")]] as const).map(([value,label])=><TabLink key={value} className="ui-tab" aria-current={filter===value?'page':undefined} href={base+'?filter='+value}>{label}</TabLink>)}</nav>
    {view.limited && <p className="mb-4 text-xs text-muted">{t("Falhas, conflitos e resultados incertos nas últimas 1.000 operações de cada origem.")}</p>}
    {!view.rows.length ? <EmptyState title={t("Nenhuma alteração neste filtro")} description={t("As prévias e os resultados das operações aparecerão aqui.")} /> : <DataTable label={t("Histórico de alterações")}><thead><tr><th>{t("Operação / origem")}</th><th>Status</th><th>{t("Verificados")}</th><th>{t("Data")}</th><th><span className="sr-only">{t("Abrir operação")}</span></th></tr></thead><tbody>{view.rows.map(row=><tr key={row.source+row.id} className="relative hover:bg-subtle/60 focus-within:bg-subtle"><td><Link href={row.href} className="font-medium after:absolute after:inset-0">{t(row.title)}</Link><p className="mt-1 text-xs text-muted">{row.source==='static'?t("Página estática · "):''}{row.target}</p></td><td><StatusBadge status={row.status} label={row.label} /></td><td className="whitespace-nowrap tabular-nums">{row.verified} / {row.total}<span className="mt-1 block text-xs text-muted">{row.source==='cms'?t("campos"):t("elementos")}</span></td><td className="whitespace-nowrap text-sm tabular-nums">{siteDate(row.createdAt, t.dateLocale)}</td><td><ArrowUpRight size={16} aria-hidden="true" /></td></tr>)}</tbody></DataTable>}
    <SitePagination page={page} hasMore={view.hasMore} base={base} query={{filter}} nextHref={view.nextCursor ? base+"?"+new URLSearchParams({filter,page:String(page+1),cursor:view.nextCursor}) : undefined} previousHref={view.previousCursor ? base+"?"+new URLSearchParams({filter,page:String(page-1),cursor:view.previousCursor,direction:"previous"}) : undefined} />
    <p className="mt-5 text-xs text-muted">{t("Verificados inclui conteúdo aplicado ou já atualizado. A publicação no Webflow é feita separadamente.")}</p>
  </SitePage>;
}
