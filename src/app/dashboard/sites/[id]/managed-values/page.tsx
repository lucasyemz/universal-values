import { RecordCard, RecordHeading, RecordMetadata, RecordFooter } from "@/components/ui/record-card";
import { ActivityValue } from "@/components/sites/activity-value";
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
import { EmptyState, StatusBadge } from "@/components/ui";
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
    {!view.values.length ? <EmptyState title={q ? t("Nenhum valor encontrado") : t("Nenhuma Variável neste filtro")} description={t("Crie um valor a partir das ocorrências encontradas em um scan.")} action={<Link className="ui-btn" href={`/dashboard/sites/${id}/scans`}>{t("Ver scans")}</Link>} /> : <ul className="space-y-3">{view.values.map(value=><RecordCard key={value.id}>
<RecordHeading icon={<Database size={25} aria-hidden="true" />}
 title={<Link prefetch={false} className="block truncate hover:text-accent" title={value.name} href={view.valueLinks[value.id]!}>{value.name}</Link>}
 subtitle={<>{t(value.canonical.type === "text" ? "Texto" : detectionLabels[value.canonical.type])} · <ResourceNumber href={view.valueLinks[value.id]!} inline /></>}
 status={<StatusBadge status={value.archived_at ? "archived" : view.sources?.[value.id]?.uncertain ? "uncertain" : "active"} label={value.archived_at ? "Arquivado" : view.sources?.[value.id]?.uncertain ? "Conferir fontes" : "Ativo"} />} />
<RecordMetadata><div className="min-w-0 flex-1"><p className="mb-1 text-xs text-muted">{t("Valor da variável")}</p><ActivityValue value={valueLabel(value.canonical)} imageUrl={value.canonical.type === "image" ? value.canonical.url : undefined} heading /></div>{origins[value.id] && <Link prefetch={false} className="text-sm text-accent" href={origins[value.id]!.href}>{t("Scan de origem")} #{origins[value.id]!.number}</Link>}</RecordMetadata>
<RecordFooter actions={<><Link prefetch={false} className="ui-btn" href={view.valueLinks[value.id]!+"#managed-sources"}>{t("Ver fontes")}</Link><Link prefetch={false} className="ui-btn ui-btn-primary" href={view.valueLinks[value.id]!+(value.archived_at?"":"#managed-editor")}>{t(value.archived_at?"Abrir Variável":"Editar valor")}<ArrowRight size={16} aria-hidden="true" /></Link></>}>
<p className="text-sm text-muted">{t("Campos vinculados")}: <strong>{view.sources?.[value.id]?.count ?? "—"}</strong></p>
</RecordFooter>
</RecordCard>)}</ul>}
    {view.sources===null && <p role="status" className="mt-3 text-sm text-muted">{t("Contagem de fontes indisponível. Abra o valor para consultar seus vínculos.")}</p>}
    <SitePagination page={page} total={view.total} base={base} query={{filter,q}} />
  </SitePage>;
}
