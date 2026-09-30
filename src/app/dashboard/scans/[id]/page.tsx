import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ScanVersionSelector } from "@/components/scans/version-selector";
import { scanDisplayStatus } from "@/modules/scans/list-summary";
import { CreatedVariables } from "@/components/scans/created-variables";
import { scanCreatedVariables } from "@/modules/scans/created-variables";
import { availableScanResultTab, visibleScanResultTabs, scanResultTabLabels } from "@/modules/scans/result-tabs";
import { sitePageNumber } from "@/modules/sites/presentation";
import { GroupActions } from "@/components/scans/group-actions";
import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("scan");
}

import { TabLink } from "@/components/ui/tab-link";
import { filterSavedGroup, savedGroupSchema } from "@/modules/scans/saved-search";
import { RememberedLink, RememberedDetails } from "@/components/layout/navigation-state";
import { ReviewedOperations } from "@/components/scans/reviewed-operations";
import { resourceLink } from "@/modules/routes/links";
import { ScanCollectionSummary } from "@/components/scans/collection-summary";
import { ReviewOperationControls } from "@/components/scans/review-operation-controls";
import { AiBatch } from "@/components/ai/batch";
import { getText } from "@/i18n/server";
import { searchOptionsLabel } from "@/modules/text-search/match";
import { randomUUID } from "node:crypto";
import { ManagedDivergence } from "@/components/scans/managed-divergence";
import { OccurrenceEditor } from "@/components/scans/occurrence-editor";
import { ImageThumbnail } from "@/components/scans/image-thumbnail";
import { imageFilename, occurrencePresentation } from "@/modules/scans/presentation";
import Link from "next/link";
import { ScanProgress } from "@/components/scans/scan-progress";
import { getScanSite, loadScanResults, scanProgress } from "@/modules/scans/service";
import { cancelScan, confirmScan } from "@/modules/scans/actions";
import { detectionLabels } from "@/modules/scans/schema";
import { countReviewedOccurrences, filterReviewedGroups, withoutVariableFields } from "@/modules/scans/reviewed-content";
import { ReviewFlag } from "@/components/scans/review-flag";
import { resultsSearchSchema, searchResultGroups } from "@/modules/scans/search-results";
import { PageHeader, Notice, StatusBadge, SectionHeader, Steps, EmptyState } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function ScanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; filter?: string; q?: string; group?: string; operation?: string; operationError?: string; page?: string }> }) {
  const t = await getText();

  const { id } = await params;
  const view = await loadScanResults(id);
  const scanHref = await resourceLink("scans",id);
  const { error, filter: filterInput, q, group: groupInput, operation, operationError, page: pageInput } = await searchParams;
  const query = resultsSearchSchema.parse(q ?? "");
  const groupKey = savedGroupSchema.parse(groupInput ?? "");
  const ordinarySections = withoutVariableFields(view.sections, view.linkedValues);
  const searched = filterSavedGroup(searchResultGroups(ordinarySections, query), groupKey);
  const counts = countReviewedOccurrences(searched, view.reviewedIds);
  const displayStatus = scanDisplayStatus(view.scan.status, countReviewedOccurrences(ordinarySections, view.reviewedIds));
  const scanCounts = countReviewedOccurrences(ordinarySections, view.reviewedIds);
  const page = sitePageNumber(pageInput);
  const created = await scanCreatedVariables(view.scan,page,filterInput === "variables");
  const tabs = visibleScanResultTabs({ reviewed: scanCounts.reviewed, variables: created.total });
  const filter = availableScanResultTab(filterInput, counts, tabs);
  const noResults = countReviewedOccurrences(view.sections, view.reviewedIds).all === 0 && created.total === 0;
  const sections = filterReviewedGroups(searched, view.reviewedIds, filter === "variables" ? "pending" : filter);
  const { scan } = view;
  const readOnly = !scan.is_latest;
  const site = await getScanSite(scan.site_id);
  return <main className="ui-page">
    <SiteContext siteName={site.display_name} title={t("Scan do CMS")} siteId={scan.site_id} workspaceId={scan.workspace_id} />
    <PageHeader
      navigation={<RememberedLink className="ui-btn" href={scanHref.replace(/\/\d+$/, "")}>{t("← Scans")}</RememberedLink>}
      eyebrow={site.display_name}
      title={scan.status === "preview" ? t("Revisar scan") : t("Revisão do scan")}
      status={<><StatusBadge status={displayStatus} label={scan.status === "cancelled" ? "Scan cancelado" : undefined}/><ScanVersionSelector id={scan.id} version={scan.scan_version}/></>}
      actions={!readOnly && ["completed", "limited", "cancelled"].includes(scan.status) && scan.plan.length > 0 ? <Link prefetch={false} className="ui-btn" href={scanHref.replace(/\/scans\/\d+$/, "/scans/new") + "?repeat=" + scanHref.split("/").at(-1)}>{t("Repetir scan")}</Link> : undefined}
    />

    {readOnly && <Notice title={t("Versão anterior · somente leitura")}>{t("Consulte os resultados desta versão. Para editar, selecione a versão mais recente.")}</Notice>}
    {scan.plan.some(entry => entry.placeholders) && <p className="mt-3 text-sm">{t("Busca de textos de exemplo: inclui ocorrências únicas, sem exigir repetição.")}</p>}
    {scan.plan[0]?.searchText && <p className="mt-3 break-words">{t("Busca específica:")} <strong>“{scan.plan[0].searchText}”</strong> — {t(searchOptionsLabel(scan.plan[0].searchOptions))}.</p>}
    {error && <p role="alert" className="mt-5 rounded border bg-amber-50 p-4">{error === "name" ? t("Use um nome de 2 a 80 caracteres, como Link de cadastro. Este campo dá um nome ao valor encontrado; ele não substitui a URL.") : error === "invalid" ? t("A solicitação de revisão é inválida. Atualize o scan e tente novamente.") : error === "selection" ? t("Selecione de 2 a 100 ocorrências do mesmo valor, em pelo menos dois campos de origem diferentes e ainda não gerenciados.") : t("Não foi possível concluir. A prévia pode ter expirado, a conexão mudou ou já existe um scan ativo para este site.")}</p>}
    {scan.status === "preview" ? <section className="mt-8 ui-card p-6">
      <Steps steps={[t("Origem e coleções"), t("O que encontrar"), t("Revisar e iniciar")]} current={2} />
      <h2 className="text-xl font-semibold">{scan.plan.length}  {t("coleções selecionadas")}</h2>
      <ul className="mt-4 list-inside list-disc">{scan.plan.map((c) => <li key={c.id}>{c.name} — {(c.types ?? ["money", "phone", "date", "number", "text"] as const).map((type) => t(type === "text" && c.placeholders ? "Textos de exemplo" : detectionLabels[type])).join(", ")}</li>)}</ul>
      <Notice title={t("Somente leitura do CMS")}>{t("O scan salva as ocorrências no seu workspace. Nenhuma alteração será feita no Webflow. Rascunhos podem aparecer; o conteúdo pode diferir do site publicado.")}</Notice>
      <details className="mt-4 rounded-lg border p-4 text-sm"><summary className="font-medium">{t("Ver cobertura e limites")}</summary>
      <p className="mt-3 text-sm">{t("Origem: CMS. Páginas estáticas não serão lidas. Cada lote lê até 25 itens, com espera de 5 segundos entre lotes, além do tempo das consultas.")}</p>
      <p className="mt-5 leading-7 text-muted">{t("Serão lidos até")} {view.scan.item_limit ?? 500}  {t("itens, em lotes de 25, com até 1.000 ocorrências armazenadas. Suporte a texto simples, números, links, imagens e galerias; no Rich Text, links, imagens e o texto específico informado (contínuo, sem tags ou entidades HTML no meio). Itens arquivados e o campo slug ficam fora da detecção.")}</p>
      <p className="mt-3 leading-7 text-muted">{t("Padrão brasileiro: preços com R$, datas dia/mês/ano ou ISO, telefones internacionais ou com DDD entre parênteses. Rascunhos podem aparecer; o conteúdo preparado pode diferir do site publicado.")}</p>
      <p className="mt-3 text-sm text-muted">{t("O scan armazena trechos dos campos no seu workspace. Campos acima de 2.000 caracteres e ocorrências além dos limites serão sinalizados como cobertura parcial.")}</p>
      </details>
      {scan.truncated && <p className="mt-3 text-amber-800">{t("Este site tem mais de 20 coleções. Apenas as primeiras 20, ordenadas por ID, serão lidas.")}</p>}
      {view.expired ? <p className="mt-6 text-amber-800">{t("Prévia expirada. Volte e prepare outro scan.")}</p> :
        <ConfirmationDialog title={t("Iniciar scan")} tone="primary"><form action={confirmScan} className="ui-action-bar mt-6 space-y-4"><input type="hidden" name="id" value={id} /><label className="flex gap-3"><input type="checkbox" name="confirmed" value="yes" required />{t("Confirmo a leitura e o armazenamento das ocorrências deste scan.")}</label><SubmitButton pendingLabel={t("Iniciando scan…")}>{t("Iniciar scan")}</SubmitButton></form></ConfirmationDialog>}
    </section> : ["queued","running","paused"].includes(scan.status) ? <ScanProgress key={scan.revision} initial={scanProgress(scan)}><ScanCollectionSummary compact scan={scan} reviewCount={0} /><ConfirmationDialog title={t("Cancelar scan")} tone="danger"><form action={cancelScan} className="mt-4 space-y-3"><input type="hidden" name="id" value={id} /><p>{t("Os resultados parciais serão desconsiderados e este scan não poderá criar novas Variáveis.")}</p><input type="hidden" name="confirmed" value="yes" /><SubmitButton pendingLabel={t("Salvando…")}>{t("Cancelar scan")}</SubmitButton></form></ConfirmationDialog></ScanProgress> :
      scan.status === "cancelled" ? <Notice tone="danger" title={t("Scan cancelado")}>{t("Os resultados parciais deste scan foram desconsiderados. Nenhuma alteração foi aplicada ao CMS por este scan.")}</Notice> : null}
    {["completed","limited"].includes(scan.status) && <ScanCollectionSummary scan={scan} reviewCount={countReviewedOccurrences(view.sections, view.reviewedIds).all} />}

    {["completed","limited"].includes(scan.status) && <section className="mt-4">

      {groupKey && filter !== "variables" && <p className="mb-3 text-sm">{t("Exibindo o grupo salvo selecionado.")} <Link prefetch={false} className="text-accent underline" href={scanHref + "?filter=" + filter}>{t("Ver todos os resultados do scan")}</Link></p>}
      {!noResults && <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("Filtrar por revisão")} className="ui-tabs">{tabs.map((option) => <TabLink key={option} href={scanHref + "?" + new URLSearchParams({ filter: option, ...(query ? { q: query } : {}), ...(groupKey ? { group: groupKey } : {}) }).toString()} aria-current={filter === option ? "page" : undefined} className="ui-tab">{t(scanResultTabLabels[option])} ({option === "variables" ? created.total : counts[option]})</TabLink>)}</nav>
        {filter !== "variables" && <form method="get" className="flex w-full gap-2 sm:w-auto">
          <input type="hidden" name="filter" value={filter}/>
          <label htmlFor="results-search" className="sr-only">{t("Pesquisar nos resultados")}</label>
          <input key={query} id="results-search" name="q" type="search" maxLength={200} defaultValue={query} placeholder={t("Pesquisar nos resultados")} className="min-w-0 flex-1 sm:w-56"/>
          <button className="ui-btn">{t("Pesquisar")}</button>
          {query && <Link href={scanHref + "?filter=" + filter} className="ui-btn">{t("Limpar")}</Link>}
        </form>}
      </div>}
      {scan.status === "limited" && <Notice tone="warning" title={t("Cobertura parcial")}>{t("Alguns campos foram ignorados ou um limite foi atingido. As alterações abrangem apenas as ocorrências abaixo.")}</Notice>}

      {filter === "variables" ? <><CreatedVariables view={created} page={page} href={scanHref} siteId={scan.site_id} occurrences={view.occurrences} linkedValues={view.linkedValues}/>      {!readOnly && view.divergences.some(d=>created.createdIds.includes(d.value.id)) && <details className="mt-5" aria-label={t("Divergências de Variáveis")}><summary className="cursor-pointer font-medium">{t("Verificar Variáveis")}</summary>
        <SectionHeader title={t("Verificar Variáveis")} description={t("Comparação das fontes detectadas neste scan com o último registro dos vínculos. Não é monitoramento em tempo real; campos sem ocorrências detectadas não foram comparados aqui.")} />
        <p className="mt-2 text-xs text-muted">{t("Scan iniciado em")} {new Date(scan.created_at).toLocaleString(t.dateLocale, { timeZone: "UTC" })}  {t("UTC. As divergências aparecem mesmo que a ocorrência não seja repetida ou tenha sido marcada como revisada.")}</p>
        {view.divergences.filter(d=>created.createdIds.includes(d.value.id)).map(d => <ManagedDivergence key={d.binding.id} id={randomUUID()} scanId={scan.id} bindingId={d.binding.id} name={d.value.name} valueId={d.value.id} version={d.value.version} central={d.value.canonical} before={d.binding.source_value} observed={d.observed} rows={d.rows} stale={d.stale} uncertain={d.binding.uncertain} />)}
      </details>}
</> : <>

      {!readOnly && operation && <ReviewOperationControls id={operation} scanId={id} error={operationError}/>}
      {view.reviewsMissing && <p role="status" className="mt-3 text-sm text-amber-800">{t("Aplique a sétima migration para habilitar as marcações de revisão.")}</p>}



      {!sections.some(section => section.duplicates.length) && <div className="mt-6"><EmptyState title={t(noResults ? "Não tivemos resultados para este scan." : filter === "pending" && counts.all > 0 ? "Tudo revisado nesta busca" : "Nenhuma ocorrência neste filtro")} description={t(noResults ? "Nenhuma ocorrência corresponde aos critérios deste scan. Você pode iniciar outro scan com uma busca diferente." : filter === "pending" && counts.all > 0 ? "Consulte os valores revisados ou inicie outro scan para buscar mudanças no CMS." : "Altere o filtro ou limpe a pesquisa para ver outros resultados.")} action={noResults ? undefined : <Link className="ui-btn" href={scanHref + "?filter=" + (filter === "pending" && counts.all > 0 ? "reviewed" : "pending")}>{t(filter === "pending" && counts.all > 0 ? "Ver revisados" : "Ver pendentes")}</Link>}/></div>}
      {sections.filter(section => section.duplicates.length > 0).map((section) => <section key={section.type} className="mt-4">
        <SectionHeader title={t(section.label)} action={<span className="text-xs text-muted">{section.duplicates.length}  {t("grupos neste filtro")}</span>} />
        {!section.duplicates.length && <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted">{t("Nenhum grupo neste filtro. Alterne entre Pendentes e Revisados ou limpe a pesquisa.")}</p>}
        {section.duplicates.map((group, groupIndex) => <div key={filter + query + group.label} className="scan-group-shell relative mt-4">
          {!readOnly && group.occurrences.some(o => !view.reviewedIds.includes(o.id)) && <GroupActions>
          {!view.reviewsMissing && <ReviewFlag compact scanId={id} pendingIds={group.occurrences.filter((o) => !view.reviewedIds.includes(o.id)).map((o) => o.id)} reviewedIds={group.occurrences.filter((o) => view.reviewedIds.includes(o.id)).map((o) => o.id)} />}
          </GroupActions>}
          <RememberedDetails initiallyOpen={groupIndex === 0} stateId={"group:" + JSON.stringify(group.occurrences[0]?.canonical)} key={filter + query + group.label} className="scan-workspace-group ui-card p-4"><summary className={"cursor-pointer break-words font-semibold " + (group.occurrences.some(o => !view.reviewedIds.includes(o.id)) ? "scan-group-heading-actions" : "")}>{group.occurrences[0]?.canonical.type === "image" ? <span className="inline-flex max-w-[95%] items-start gap-3 align-middle">
            <ImageThumbnail url={group.occurrences[0].canonical.url} alt=""/>
            <span className="min-w-0"><span className="block">{imageFilename(group.occurrences[0].canonical.url)}</span><span className="sr-only">{group.occurrences[0].canonical.url}</span><span className="mt-2 block text-xs font-normal">{group.occurrences.length} {t("ocorrências")}</span><span className="mt-1 block truncate text-xs font-normal text-muted" title={[...new Set(group.occurrences.map(o => o.item_name))].join(" · ")}>{[...new Set(group.occurrences.map(o => o.item_name))].join(" · ")}</span></span>
          </span> : <>{group.label} · {group.occurrences.length} {t("ocorrências")}</>}</summary>
          {!readOnly && group.occurrences.some(o => !view.reviewedIds.includes(o.id)) && <AiBatch selectionScoped scanId={id} groupId={group.occurrences[0]!.id}>
          <OccurrenceEditor outcomes={view.outcomes} userId={scan.actor_id} editableBoundOccurrenceIds={view.editableBoundOccurrenceIds} reviewedIds={view.reviewedIds} scanId={scan.id} linkedValues={view.linkedValues} rows={group.occurrences.filter(o => !view.reviewedIds.includes(o.id)).map((occurrence) => ({ occurrence, display: occurrencePresentation(occurrence) }))} />

          </AiBatch>}
          {readOnly && group.occurrences.filter(o=>!view.reviewedIds.includes(o.id)).map(o=><section key={o.id} className="mt-4 rounded-xl border p-4"><h3 className="font-semibold">{o.item_name}</h3><p className="text-xs text-muted">{o.collection_name} → {o.field_name}</p>{o.canonical.type === "image" ? <ImageThumbnail url={o.canonical.url} alt=""/> : <p className="mt-3 whitespace-pre-wrap break-words text-sm">{o.source_value}</p>}</section>)}
          <ReviewedOperations readOnly={readOnly} occurrences={group.occurrences.filter(o => view.reviewedIds.includes(o.id))} history={view.reviewHistory} outcomes={view.outcomes} />
        </RememberedDetails></div>)}
      </section>)}
      </>}
    </section>}
  </main>;
}
