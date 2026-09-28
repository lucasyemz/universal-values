import { TextChangeDiff } from "@/components/scans/text-change-diff";
import { managedSourceLabels } from "@/modules/managed-values/source-labels";
import { sitePageNumber } from "@/modules/sites/presentation";
import { resourceLink } from "@/modules/routes/links";
import { History, ArrowRight } from "lucide-react";
import { variableScanOrigins } from "@/modules/scans/created-variables";
import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("value");
}

import { getText } from "@/i18n/server";
import { RememberedLink } from "@/components/layout/navigation-state";
import { siteLink } from "@/modules/routes/links";
import { ArchiveManagedValue } from "@/components/archive-managed-value";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadManagedSyncValue } from "@/modules/managed-values/sync-service";
import { valueLabel } from "@/modules/scans/schema";
import { PageHeader, SectionHeader, Notice, StatusBadge } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { ManagedValueEditor } from "@/components/managed-value-editor";

export default async function ManagedValuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{page?:string}> }) {
  const t = await getText();

  const view = await loadManagedSyncValue((await params).id, true);
  const { value, bindings, site, history } = view;
  const base = await siteLink(value.site_id);
  const sourceRows=value.archived_at ? view.archivedBindings : bindings;
  const page=Math.min(sitePageNumber((await searchParams).page),Math.max(1,Math.ceil(sourceRows.length/10)));
  const visibleSources=sourceRows.slice((page-1)*10,page*10);
  const labels=await managedSourceLabels(value.site_id,visibleSources.map(binding=>binding.source_key));
  const href=await resourceLink("managed-values",value.id);
  const origin = (await variableScanOrigins(value.site_id,[value.id]))[value.id];
  const initialFields=visibleSources.map(binding=>({sourceKey:binding.source_key,collection:labels[binding.source_key]?.collection_name || t("Coleção sem nome registrado"),item:labels[binding.source_key]?.item_name || t("Item sem nome registrado"),field:labels[binding.source_key]?.field_name || binding.field_slug,locale:"",collectionId:binding.collection_id,itemId:binding.item_id,before:view.verifiedFields[binding.source_key]?.before ?? binding.source_value,after:view.verifiedFields[binding.source_key]?.after ?? binding.source_value,images:binding.canonical.type==="image"?[{before:binding.canonical.url,after:binding.canonical.url}]:[],slug:null}));
  const sourcesFooter=<nav aria-label={t("Paginação")} className="flex flex-wrap items-center gap-3"><span className="text-sm text-muted">{t("Página")} {page} · {sourceRows.length} {t("fontes")}</span>{page>1 && <Link prefetch={false} className="ui-btn" href={href+"?page="+(page-1)+"#managed-sources"}>{t("Anterior")}</Link>}{page*10<sourceRows.length && <Link prefetch={false} className="ui-btn" href={href+"?page="+(page+1)+"#managed-sources"}>{t("Próxima")}</Link>}</nav>;
  const sourcesContent=(<section id="managed-sources" className="mt-8 scroll-mt-6"><SectionHeader title={value.archived_at ? t("Origens liberadas no arquivamento") : t("Origens vinculadas")} description={t("Último resultado registrado. Ao editar, confira aqui a prévia antes de confirmar.")} /><ul className="space-y-3">{visibleSources.map(binding=>{const label=labels[binding.source_key];return <li key={binding.id} className="ui-card p-5"><h3 className="font-semibold">{label?.item_name || t("Item sem nome registrado")}</h3><p className="mt-1 text-sm text-muted">{label?.collection_name || t("Coleção sem nome registrado")} → {label?.field_name || binding.field_slug}</p><div className="mt-4">{view.verifiedFields[binding.source_key] ? <TextChangeDiff marked highlight={binding.canonical.type==="text"} before={view.verifiedFields[binding.source_key]!.before} after={view.verifiedFields[binding.source_key]!.after} beforeLabel={t("Antes")} afterLabel={t("Resultado verificado da operação")} /> : <><p className="text-xs text-muted">{t("Último conteúdo registrado")}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{binding.source_value}</p></>}</div><p className="mt-3 text-xs text-muted">{binding.uncertain?t("Resultado incerto"):binding.last_synced_at?new Date(binding.last_synced_at).toLocaleString(t.dateLocale,{timeZone:"UTC"})+" UTC":t("Registro inicial do scan")}</p><details className="mt-3 text-xs text-muted"><summary>{t("Detalhes da origem")}</summary><p className="mt-2 break-all">{t("Coleção")}: {binding.collection_id} · Item: {binding.item_id} · Locale: {binding.locale || t("padrão")}</p></details></li>})}</ul><nav aria-label={t("Paginação")} className="mt-4 flex flex-wrap items-center gap-3"><span className="text-sm text-muted">{t("Página")} {page} · {sourceRows.length} {t("fontes")}</span>{page>1 && <Link prefetch={false} className="ui-btn" href={href+"?page="+(page-1)+"#managed-sources"}>{t("Anterior")}</Link>}{page*10<sourceRows.length && <Link prefetch={false} className="ui-btn" href={href+"?page="+(page+1)+"#managed-sources"}>{t("Próxima")}</Link>}</nav></section>);
  return <main className="ui-page">
    <SiteContext title={value.name} siteName={site.display_name} siteId={value.site_id} workspaceId={site.workspace_id} />
    <RememberedLink className="ui-btn" href={base + "/variables"}>{t("← Variáveis")}</RememberedLink>
    <PageHeader eyebrow={t("Variável")} title={value.name} description={t("Um valor compartilhado por {0} fontes do CMS.", sourceRows.length)} />
    {view.missingMigration ? <Notice tone="warning">{t("Aplique as migrations até a 015 para habilitar a sincronização em segundo plano.")}</Notice> : <>
      {view.activeOperation && <Notice tone="warning" title={t("A aplicação no CMS ainda não terminou")}>
        {view.activeOperation.outcome.verified}  {t("de")} {view.activeOperation.total}  {t("fontes verificadas nesta operação. Salvar o valor central não conclui a sincronização. O worker continua no servidor mesmo com o navegador fechado. Confira o progresso e eventuais pausas na operação.")} <Link className="ui-btn mt-3 inline-flex" href={"/dashboard/changes/" + view.activeOperation.id}>{t("Acompanhar aplicação no CMS")}</Link>
      </Notice>}
      {view.uncertain > 0 && <Notice tone="warning">{view.aligned}  {t("de")} {bindings.length}  {t("fontes têm o valor central registrado.")} {view.uncertain > 0 && t("{0} fontes possuem resultado incerto.", view.uncertain)} </Notice>}
      {value.archived_at ? <Notice><p className="mb-2 font-semibold">{valueLabel(value.canonical)}</p>{t("Valor arquivado. As fontes foram liberadas; o histórico permanece disponível.")}</Notice> : <ManagedValueEditor key={value.version} id={randomUUID()} valueId={value.id} version={value.version} canonical={value.canonical} textSources={visibleSources.flatMap(binding=>binding.canonical.type==="text" && (binding.field_type==="PlainText" || binding.field_type==="RichText") ? [{sourceKey:binding.source_key,source:binding.source_value,fieldType:binding.field_type,locations:binding.locations}] : [])} initialFields={initialFields} sourcesFooter={sourcesFooter} disabled={!bindings.length || history.some(request => request.status === "confirmed")} />}


{value.archived_at && sourcesContent}
<details className="ui-card mt-6 p-5"><summary className="cursor-pointer font-semibold">{t("Histórico e detalhes da variável")}</summary><p className="mt-4 text-sm text-muted">{t("Versão {0} · {1} fontes vinculadas",value.version,bindings.length)}</p>{origin && <Link prefetch={false} className="text-sm text-accent underline" href={origin.href}>{t("Scan de origem")} #{origin.number}</Link>}      <section className="mt-8"><SectionHeader title={t("Sincronizações")} description={t("Prévias, operações em andamento e resultados recentes.")} />
        {!history.length ? <p className="text-sm text-muted">{t("Nenhuma sincronização preparada.")}</p> : <ul className="space-y-3">{history.map(request=><li key={request.id} className="ui-card flex flex-wrap items-center gap-4 p-5"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent"><History size={24} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="font-semibold">{t("Sincronizações")} · {value.name}</h3><p className="mt-1 text-xs text-muted">{new Date(request.created_at).toLocaleString(t.dateLocale,{timeZone:"UTC"})} UTC</p><p className="mt-2 text-sm">{request.outcome.verified}/{request.total} {t("verificados")}{request.outcome.issues>0 && t(" · {0} com problemas",request.outcome.issues)}</p></div><StatusBadge status={request.outcome.badge} label={request.outcome.label} /><Link prefetch={false} className="ui-btn" href={"/dashboard/changes/"+request.id}>{t("Ver detalhes")}<ArrowRight size={16}/></Link></li>)}</ul>}
      </section>
{!value.archived_at && <ArchiveManagedValue valueId={value.id} />}</details>
    </>}
  </main>;
}
