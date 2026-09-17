import { OccurrenceEditor } from "@/components/scans/occurrence-editor";
import { occurrencePresentation } from "@/modules/scans/presentation";
import Link from "next/link";
import { ScanProgress } from "@/components/scans/scan-progress";
import { loadScanResults, scanProgress } from "@/modules/scans/service";
import { cancelScan, confirmScan } from "@/modules/scans/actions";
import { detectionLabels } from "@/modules/scans/schema";
import { filterReviewedGroups, reviewFilterSchema, reviewFilterLabels } from "@/modules/scans/reviewed-content";
import { ReviewFlag } from "@/components/scans/review-flag";
import { resultsSearchSchema, searchResultGroups } from "@/modules/scans/search-results";

export default async function ScanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; filter?: string; q?: string }> }) {
  const { id } = await params;
  const view = await loadScanResults(id);
  const { error, filter: filterInput, q } = await searchParams;
  const query = resultsSearchSchema.parse(q ?? "");
  const filter = reviewFilterSchema.catch("pending").parse(filterInput);
  const sections = searchResultGroups(filterReviewedGroups(view.sections, view.reviewedIds, filter), query);
  const { scan } = view;
  return <main className="mx-auto max-w-5xl px-6 py-12">
    <Link href={"/dashboard/sites/" + scan.site_id + "/scans"} className="text-teal-800">← Scans e valores</Link>
    <h1 className="mt-6 text-3xl font-semibold">{scan.status === "preview" ? "Revisar scan" : "Scan do CMS"}</h1>
    {scan.plan[0]?.searchText && <p className="mt-3 break-words">Texto específico: <strong>“{scan.plan[0].searchText}”</strong> — busca literal, diferenciando maiúsculas e minúsculas.</p>}
    {error && <p role="alert" className="mt-5 rounded border bg-amber-50 p-4">{error === "name" ? "Use um nome de 2 a 80 caracteres, como Link de cadastro. Este campo dá um nome ao valor encontrado; ele não substitui a URL." : error === "invalid" ? "A solicitação de revisão é inválida. Atualize o scan e tente novamente." : error === "selection" ? "Selecione de 2 a 100 ocorrências do mesmo valor, em pelo menos dois campos de origem diferentes e ainda não gerenciados." : "Não foi possível concluir. A prévia pode ter expirado, a conexão mudou ou já existe um scan ativo para este site."}</p>}
    {scan.status === "preview" ? <section className="mt-8 rounded-xl border bg-white p-6">
      <h2 className="text-xl font-semibold">{scan.plan.length} coleções selecionadas</h2>
      <ul className="mt-4 list-inside list-disc">{scan.plan.map((c) => <li key={c.id}>{c.name} — {(c.types ?? ["money", "phone", "date", "number", "text"] as const).map((type) => detectionLabels[type]).join(", ")}</li>)}</ul>
      <p className="mt-3 text-sm">Origem: CMS. Páginas estáticas não serão lidas. Cada lote lê até 25 itens, com espera de 5 segundos entre lotes, além do tempo das consultas.</p>
      <p className="mt-5 leading-7 text-slate-600">Serão lidos até 500 itens, em lotes de 25, com até 1.000 ocorrências armazenadas. Suporte a texto simples, números, links, imagens e galerias; no Rich Text, links, imagens e o texto específico informado (contínuo, sem tags ou entidades HTML no meio). Itens arquivados e o campo slug ficam fora da detecção.</p>
      <p className="mt-3 leading-7 text-slate-600">Padrão brasileiro: preços com R$, datas dia/mês/ano ou ISO, telefones internacionais ou com DDD entre parênteses. Rascunhos podem aparecer; o conteúdo preparado pode diferir do site publicado.</p>
      <p className="mt-3 text-sm text-slate-600">O scan armazena trechos dos campos no seu workspace. Campos acima de 2.000 caracteres e ocorrências além dos limites serão sinalizados como cobertura parcial.</p>
      {scan.truncated && <p className="mt-3 text-amber-800">Este site tem mais de 20 coleções. Apenas as primeiras 20, ordenadas por ID, serão lidas.</p>}
      {view.expired ? <p className="mt-6 text-amber-800">Prévia expirada. Volte e prepare outro scan.</p> :
        <form action={confirmScan} className="mt-6 space-y-4"><input type="hidden" name="id" value={id} /><label className="flex gap-3"><input type="checkbox" name="confirmed" value="yes" required />Confirmo a leitura e o armazenamento das ocorrências deste scan.</label><button className="rounded bg-teal-800 px-4 py-3 text-white">Iniciar scan</button></form>}
    </section> : ["running","paused"].includes(scan.status) ? <ScanProgress key={scan.revision} initial={scanProgress(scan)} /> :
      <p role="status" className="mt-6">{scan.status === "cancelled" ? "Scan cancelado." : scan.status === "limited" ? "Scan finalizado com cobertura parcial." : "Scan concluído."} {scan.items_read} itens lidos · {scan.occurrences_count} ocorrências.</p>}
    {["running","paused"].includes(scan.status) && <details className="mt-6"><summary className="cursor-pointer text-sm">Cancelar este scan</summary><form action={cancelScan} className="mt-4 space-y-3"><input type="hidden" name="id" value={id} /><p>Os lotes salvos serão preservados, mas este scan não poderá criar novos Managed Values.</p><label className="flex gap-2"><input type="checkbox" name="confirmed" value="yes" required />Confirmo o cancelamento.</label><button className="rounded border px-4 py-2">Cancelar scan</button></form></details>}
    {["completed","limited"].includes(scan.status) && <section className="mt-10">
      <p className="text-slate-600">Cada grupo reúne ocorrências com o mesmo valor. Altere cada caso ou preencha um novo valor apenas para as ocorrências daquele grupo.</p>
      <form method="get" className="mt-5 space-y-2">
        <input type="hidden" name="filter" value={filter} />
        <label htmlFor="results-search" className="block font-medium">Pesquisar nos resultados</label>
        <div className="flex flex-wrap gap-2">
          <input key={query} id="results-search" name="q" type="search" maxLength={200} defaultValue={query} placeholder="Ex.: nome da empresa parceira" className="min-w-0 flex-1 rounded border px-3 py-2" />
          <button className="rounded bg-teal-800 px-4 py-2 text-white">Pesquisar</button>
          {query && <Link href={"/dashboard/scans/" + id + "?filter=" + filter} className="rounded border px-4 py-2">Limpar</Link>}
        </div>
        <p className="text-sm text-slate-600">Filtra valores e títulos já detectados, sem diferenciar maiúsculas e minúsculas. Para encontrar um trecho dentro de parágrafos, informe Texto específico ao preparar um novo scan.</p>
      </form>
      <nav aria-label="Filtrar por revisão" className="mt-5 flex flex-wrap gap-2">{reviewFilterSchema.options.map((option) => <Link key={option} href={"/dashboard/scans/" + id + "?" + new URLSearchParams({ filter: option, ...(query ? { q: query } : {}) }).toString()} aria-current={filter === option ? "page" : undefined} className={"rounded-full border px-4 py-2 text-sm " + (filter === option ? "border-teal-800 bg-teal-800 text-white" : "bg-white text-teal-800")}>{reviewFilterLabels[option]}</Link>)}</nav>
      <p className="mt-3 text-sm text-slate-600">Revisados ficam fora de Pendentes, mas continuam editáveis nos filtros Revisados e Todos. Novas origens ou mudanças no conteúdo voltam como pendentes.</p>
      {view.reviewsMissing && <p role="status" className="mt-3 text-sm text-amber-800">Aplique a sétima migration para habilitar as marcações de revisão.</p>}
      {scan.status === "limited" && <p className="mt-4 text-amber-800">Scan parcial: alguns campos foram ignorados ou um limite foi atingido. As alterações abrangem apenas as ocorrências abaixo.</p>}
      {sections.map((section) => <section key={section.type} className="mt-8">
        <h2 className="text-2xl font-semibold">{section.label}</h2>
        {!section.duplicates.length && <p className="mt-4 text-slate-600">Nenhum grupo de valores repetidos neste filtro.</p>}
        {section.duplicates.map((group) => <div key={filter + query + group.label} className="mt-5 rounded-xl border p-5">
          {!view.reviewsMissing && <ReviewFlag scanId={id} pendingIds={group.occurrences.filter((o) => !view.reviewedIds.includes(o.id)).map((o) => o.id)} reviewedIds={group.occurrences.filter((o) => view.reviewedIds.includes(o.id)).map((o) => o.id)} />}
          <OccurrenceEditor scanId={scan.id} rows={group.occurrences.map((occurrence) => ({ occurrence, display: occurrencePresentation(occurrence) }))} />
        </div>)}
      </section>)}
    </section>}
  </main>;
}
