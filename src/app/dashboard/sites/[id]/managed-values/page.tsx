import { ResourceNumber } from "@/components/ui/resource-number";
import { variableScanOrigins } from "@/modules/scans/created-variables";
import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("values");
}

import { TabLink } from "@/components/ui/tab-link";
import { siteLink } from "@/modules/routes/links";
import { ArrowRight, Database } from "lucide-react";
import { getText } from "@/i18n/server";
import Link from "next/link";
import { SitePage, SitePagination } from "@/components/sites/site-page";
import { EmptyState } from "@/components/ui";
import { siteValuesPage } from "@/modules/sites/page-service";
import { sitePageNumber, siteSearchSchema, valueFilterSchema } from "@/modules/sites/presentation";
import { valueLabel, detectionLabels } from "@/modules/scans/schema";

export default async function ValuesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; q?: string; filter?: string }> }) {
  const t = await getText();

  const { id } = await params, query = await searchParams; const page=sitePageNumber(query.page), filter=valueFilterSchema.catch("active").parse(query.filter), q=siteSearchSchema.parse(query.q??"");
  const view=await siteValuesPage(id,page,q,filter), base=(await siteLink(id))+"/variables";
  const origins = await variableScanOrigins(id,view.values.map(value=>value.id));
  return <SitePage site={view.site} title={t("Variáveis")} description={t("Uma variável guarda um valor reutilizado em campos do CMS. Edite uma vez, revise os itens e confirme a aplicação.")}>
    <form method="get" className="mb-5 flex flex-wrap items-end gap-3"><input type="hidden" name="filter" value={filter} /><label className="flex-1 text-sm font-medium">{t("Buscar por nome")}<input key={q} name="q" type="search" defaultValue={q} maxLength={200} placeholder={t("Ex.: Telefone comercial")} className="mt-2 block w-full" /></label><button className="ui-btn">{t("Buscar")}</button>{q && <Link className="ui-btn ui-btn-ghost" href={base+"?filter="+filter}>{t("Limpar")}</Link>}</form>
    <nav aria-label={t("Filtrar valores")} className="ui-tabs mb-6">{([['active',t("Ativos")],['archived',t("Arquivados")],['all',t("Todos")]] as const).map(([value,label])=><TabLink key={value} className="ui-tab" aria-current={filter===value?'page':undefined} href={base+'?'+new URLSearchParams({filter:value,q})}>{label}</TabLink>)}</nav>
    {!view.values.length ? <EmptyState title={q ? t("Nenhum valor encontrado") : t("Nenhuma Variável neste filtro")} description={t("Crie um valor a partir das ocorrências encontradas em um scan.")} action={<Link className="ui-btn" href={`/dashboard/sites/${id}/scans`}>{t("Ver scans")}</Link>} /> : <ul className="space-y-3">{view.values.map(value=><li key={value.id} className="ui-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-3 xl:grid-cols-[auto_minmax(10rem,1fr)_minmax(12rem,1.4fr)_auto_auto] xl:gap-x-5">
<ResourceNumber href={view.valueLinks[value.id]!} />
<div className="min-w-0 flex-1"><p className="mb-1 text-xs font-medium text-muted">{t("Nome da variável")}</p><h2 className="flex items-center gap-2 font-semibold"><Database size={17} className="shrink-0 text-accent" aria-hidden="true" /><Link prefetch={false} href={view.valueLinks[value.id]!}>{value.name}</Link></h2><p className="mt-1 text-xs text-muted">{t(value.canonical.type === "text" ? "Texto" : detectionLabels[value.canonical.type])} · {t(value.archived_at?"Arquivado":view.sources?.[value.id]?.uncertain?"Conferir fontes":"Ativo")}</p></div><div className="col-span-2 min-w-0 border-t pt-2 xl:col-span-1 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"><p className="text-xs font-medium text-muted">{t("Valor da variável")}</p><p title={valueLabel(value.canonical)} className="mt-1 truncate text-sm font-medium">{valueLabel(value.canonical)}</p></div>
<div className="col-span-2 text-xs text-muted xl:col-span-1"><p>{t("Campos vinculados")}: <span className="font-semibold text-ink">{view.sources?.[value.id]?.count ?? "—"}</span></p>{origins[value.id] && <Link prefetch={false} className="mt-1 block text-xs text-accent underline" href={origins[value.id]!.href}>{t("Scan de origem")} #{origins[value.id]!.number}</Link>}</div>
<div className="col-span-2 flex flex-wrap gap-2 xl:col-span-1 xl:justify-end"><Link prefetch={false} className="ui-btn" href={view.valueLinks[value.id]!+"#managed-sources"}>{t("Ver fontes")}</Link><Link prefetch={false} className="ui-btn ui-btn-primary" href={view.valueLinks[value.id]!+(value.archived_at?"":"#managed-editor")}>{t(value.archived_at?"Abrir Variável":"Editar valor")}<ArrowRight size={16} aria-hidden="true" /></Link></div>
</li>)}</ul>}
    {view.sources===null && <p role="status" className="mt-3 text-sm text-muted">{t("Contagem de fontes indisponível. Abra o valor para consultar seus vínculos.")}</p>}
    <SitePagination page={page} total={view.total} base={base} query={{filter,q}} />
  </SitePage>;
}
