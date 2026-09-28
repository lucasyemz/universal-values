import { ChangeCard } from "@/components/sites/change-card";
import { siteLink } from "@/modules/routes/links";
import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("changes");
}

import { TabLink } from "@/components/ui/tab-link";
import { getText } from "@/i18n/server";


import { SitePage, SitePagination } from "@/components/sites/site-page";
import { EmptyState } from "@/components/ui";
import { siteChangesPage } from "@/modules/sites/page-service";
import { sitePageNumber, changeFilterSchema } from "@/modules/sites/presentation";
export default async function ChangesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; filter?: string; cursor?:string; direction?:string }> }) {
  const t = await getText();

  const { id }=await params, query=await searchParams, page=sitePageNumber(query.page), filter=changeFilterSchema.catch('all').parse(query.filter);
  const view=await siteChangesPage(id,page,filter,query.cursor,query.direction==="previous"),base=(await siteLink(id))+"/changes";
  return <SitePage site={view.site} title={t("Histórico")} description={t("Consulte prévias e operações do CMS e das páginas estáticas.")}>
    <nav className="ui-tabs mb-6" aria-label={t("Filtrar alterações")}>{([['all',t("Todas")],['cms','CMS'],['static',t("Páginas estáticas")],['attention',t("Precisam de atenção")]] as const).map(([value,label])=><TabLink key={value} className="ui-tab" aria-current={filter===value?'page':undefined} href={base+'?filter='+value}>{label}</TabLink>)}</nav>
    {view.limited && <p className="mb-4 text-xs text-muted">{t("Falhas, conflitos e resultados incertos nas últimas 1.000 operações de cada origem.")}</p>}
    {!view.rows.length ? <EmptyState title={t("Nenhuma alteração neste filtro")} description={t("As prévias e os resultados das operações aparecerão aqui.")} /> : <ul className="grid gap-3" aria-label={t("Histórico de alterações")}>{view.rows.map(row => <ChangeCard horizontal key={row.source + row.id} row={row} />)}</ul>}
    <SitePagination page={page} hasMore={view.hasMore} base={base} query={{filter}} nextHref={view.nextCursor ? base+"?"+new URLSearchParams({filter,page:String(page+1),cursor:view.nextCursor}) : undefined} previousHref={view.previousCursor ? base+"?"+new URLSearchParams({filter,page:String(page-1),cursor:view.previousCursor,direction:"previous"}) : undefined} />
    <p className="mt-5 text-xs text-muted">{t("Verificados inclui conteúdo aplicado ou já atualizado. A publicação no Webflow é feita separadamente.")}</p>
  </SitePage>;
}
