import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ArrowRight, ScanLine, ShieldCheck } from "lucide-react";
import { loadSiteScans, loadScanCollections } from "@/modules/scans/service";
import { previewScan } from "@/modules/scans/actions";
import { valueLabel, detectionTypes, detectionLabels, searchedScanTypes } from "@/modules/scans/schema";
import { SiteContext } from "@/components/layout/app-shell";
import { DataTable, EmptyState, Notice, PageHeader, SectionHeader, StatusBadge, Steps } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function SiteScansPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const view = await loadSiteScans(id);
  const { error } = await searchParams;
  const collections = view.missingMigration ? [] : await loadScanCollections(id).catch(() => null);
  return <main className="ui-page">
    <SiteContext title={view.site.display_name} siteId={id} workspaceId={view.site.workspace_id} />
    <PageHeader eyebrow={view.site.display_name} title="Scans e valores" description="Encontre informações repetidas e decida o que precisa mudar." actions={<Link href="#new-scan" className="ui-btn ui-btn-primary"><ScanLine size={16} />Novo scan</Link>} />
    <nav aria-label="Seções do site" className="mb-8 flex flex-wrap gap-5 border-b pb-4 text-sm font-medium"><a href="#recent-scans" className="text-accent">Scans recentes</a><a href="#managed-values" className="text-muted">Managed Values</a><a href="#changes" className="text-muted">Alterações</a><Link href={"/dashboard/sites/" + id} className="text-muted">Explorar CMS</Link></nav>
    {error && <Notice tone="danger" title="Não foi possível preparar o scan">{error === "scope" ? "Escolha CMS, pelo menos um tipo ou texto específico e de 1 a 20 coleções." : "Confira a conexão Webflow e tente novamente."}</Notice>}
    {view.missingMigration ? <Notice tone="warning" title="Configuração de scans pendente">Aplique a terceira migration indicada no guia de scans.</Notice> : <>
      <section id="recent-scans" className="scroll-mt-6"><SectionHeader title="Scans recentes" description="Abra um scan para acompanhar a leitura ou revisar os resultados." />
        {!view.scans.length ? <EmptyState title="Encontre suas primeiras repetições" description="Escolha as coleções e os tipos de informação. O scan apenas lê o conteúdo do CMS." action={<a href="#new-scan" className="ui-btn">Preparar primeiro scan<ArrowRight size={15} /></a>} /> :
          <DataTable label="Scans recentes"><thead><tr><th>Iniciado em</th><th>Status</th><th>O que foi pesquisado</th><th>Ocorrências</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{view.scans.map((scan) => <tr key={scan.id}><td className="whitespace-nowrap tabular-nums"><Link href={"/dashboard/scans/" + scan.id} className="font-medium">{new Date(scan.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</Link><p className="mt-1 text-xs text-muted">{scan.items_read} itens lidos</p></td><td><StatusBadge status={scan.status} /></td><td><ul aria-label="Tipos pesquisados" className="flex min-w-48 max-w-md flex-wrap gap-1">{searchedScanTypes(scan).map((type) => <li key={type} className="rounded border bg-subtle px-2 py-0.5 text-[11px] text-muted">{detectionLabels[type]}</li>)}</ul>{scan.plan[0]?.searchText && <p className="mt-2 max-w-sm break-words text-xs">Texto: “{scan.plan[0].searchText}”</p>}</td><td className="tabular-nums">{scan.occurrences_count}</td><td><Link href={"/dashboard/scans/" + scan.id} className="ui-btn">{["running", "paused"].includes(scan.status) ? "Acompanhar" : scan.status === "preview" ? "Revisar prévia" : "Ver resultados"}<ArrowRight size={14} /></Link></td></tr>)}</tbody></DataTable>}
      </section>
      <section id="new-scan" className="mt-10 scroll-mt-6 ui-card p-6 md:p-8">
        <SectionHeader title="Prepare um novo scan" description="Você escolhe onde buscar. Nenhuma alteração será feita no CMS." action={<ShieldCheck size={21} className="text-accent" />} />
        <Steps steps={["Origem e coleções", "O que encontrar", "Revisar e iniciar"]} current={0} />
        <form action={previewScan} className="space-y-6">
          <input type="hidden" name="id" value={randomUUID()} /><input type="hidden" name="siteId" value={id} />
          <div className="grid gap-8 xl:grid-cols-2">
            <div className="space-y-6"><fieldset className="space-y-3"><legend className="mb-3 font-semibold">1. Onde buscar?</legend>
              <label className="ui-selection"><input type="radio" name="source" value="cms" required /><span>CMS Webflow<span className="block text-xs text-muted">Textos, números, links, imagens e galerias</span></span></label>
              <label className="flex items-center gap-2 text-xs text-muted"><input type="radio" disabled />Páginas estáticas — ainda não disponível</label>
            </fieldset>
            <fieldset><legend className="mb-2 font-semibold">Coleções</legend><p className="mb-3 text-xs text-muted">Selecione de 1 a 20. Menos coleções tornam a leitura mais rápida.</p>
              <div className="max-h-72 space-y-2 overflow-y-auto p-1">{collections === null ? <Notice tone="danger">Não foi possível carregar as coleções. Confira a conexão e atualize a página.</Notice> : collections.length === 0 ? <p className="text-muted">Nenhuma coleção disponível.</p> : collections.map((c) => <label key={c.id} className="ui-selection"><input type="checkbox" name="collectionIds" value={c.id} />{c.displayName}</label>)}</div>
            </fieldset></div>
            <div className="space-y-6"><fieldset><legend className="mb-3 font-semibold">2. O que você quer encontrar?</legend>
              <div className="grid gap-2 sm:grid-cols-2">{detectionTypes.map((type) => <label key={type} className="ui-selection text-sm"><input type="checkbox" name="types" value={type} />{detectionLabels[type]}</label>)}</div>
              <p className="mt-3 text-xs text-muted">Selecione pelo menos um tipo ou informe um texto específico.</p>
            </fieldset>
            <div className="rounded-xl bg-accent-soft p-4"><label htmlFor="search-text" className="block font-semibold">Buscar um texto específico <span className="font-normal text-muted">(opcional)</span></label><input id="search-text" name="searchText" maxLength={200} placeholder="Ex.: nome de uma empresa parceira" className="mt-3 w-full" aria-describedby="search-text-help" /><p id="search-text-help" className="mt-2 text-xs leading-6 text-muted">Encontre uma menção dentro de parágrafos e substitua só esse trecho. Busca literal, diferenciando maiúsculas e minúsculas. Outros tipos selecionados continuam sendo pesquisados.</p></div></div>
          </div>
          <details className="rounded-lg border p-4 text-xs text-muted"><summary className="font-medium">Ver cobertura e limites do scan</summary><div className="mt-3 space-y-2 leading-6"><p>Todos os itens das coleções escolhidas precisam ser lidos. Até 500 itens e 1.000 ocorrências; campos acima de 2.000 caracteres ficam fora do scan. O resultado é sinalizado como parcial quando um limite é atingido.</p><p>No Rich Text, o texto específico precisa estar contínuo, sem tags ou entidades HTML no meio. Apenas valores com duas ou mais ocorrências formam grupos de edição. O texto informado substitui a detecção de textos inteiros pela busca de menções.</p><p>O scan lê conteúdo preparado no CMS, incluindo rascunhos. Páginas estáticas não serão lidas.</p></div></details>
          <div className="ui-action-bar flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-muted">Na próxima etapa, revise o escopo e confirme a leitura.</p><SubmitButton disabled={!collections?.length} pendingLabel="Preparando scan…">Revisar scan<ArrowRight size={15} /></SubmitButton></div>
        </form>
      </section>
      <section id="managed-values" className="mt-10 scroll-mt-6"><SectionHeader title="Managed Values" description="Valores centralizados e suas origens vinculadas neste site." />
        {!view.values.length ? <EmptyState title="Nenhum Managed Value cadastrado" description="Valores centralizados organizam informações e suas origens. Você já pode editar ocorrências diretamente pelos resultados de um scan." action={<a href="#recent-scans" className="ui-btn">Ver scans</a>} /> : <DataTable label="Managed Values"><thead><tr><th>Nome</th><th>Valor</th><th>Tipo</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{view.values.map((value) => <tr key={value.id}><td><Link href={"/dashboard/managed-values/" + value.id} className="font-semibold text-accent">{value.name}{value.archived_at ? " (arquivado)" : ""}</Link></td><td className="max-w-sm break-words">{valueLabel(value.canonical)}</td><td className="text-muted">{detectionLabels[value.canonical.type]}</td><td><Link href={"/dashboard/managed-values/" + value.id} className="ui-btn">Ver origens</Link></td></tr>)}</tbody></DataTable>}
      </section>
      <section id="changes" className="mt-10 scroll-mt-6"><SectionHeader title="Alterações no CMS" description="Prévias e operações registradas. Abra para conferir os resultados." />
        {!view.changes.length ? <EmptyState title="Seu histórico começa com uma revisão" description="Depois de editar ocorrências e preparar uma prévia, você poderá acompanhar a operação aqui." action={<a href="#recent-scans" className="ui-btn">Revisar um scan</a>} /> : <DataTable label="Alterações no CMS"><thead><tr><th>Preparada em</th><th>Status</th><th>Campos processados</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{view.changes.map((change) => <tr key={change.id}><td className="tabular-nums">{new Date(change.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td><td><StatusBadge status={change.status} /></td><td className="tabular-nums">{change.cursor} de {change.total}</td><td><Link href={"/dashboard/changes/" + change.id} className="ui-btn">Ver operação<ArrowRight size={14} /></Link></td></tr>)}</tbody></DataTable>}
      </section>
    </>}
  </main>;
}
