import { randomUUID } from "node:crypto";
import Link from "next/link";
import { loadSiteScans, loadScanCollections } from "@/modules/scans/service";
import { previewScan } from "@/modules/scans/actions";
import { valueLabel, detectionTypes, detectionLabels, searchedScanTypes } from "@/modules/scans/schema";

export default async function SiteScansPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const view = await loadSiteScans(id);
  const { error } = await searchParams;
  const collections = view.missingMigration ? [] : await loadScanCollections(id).catch(() => null);
  return <main className="mx-auto max-w-4xl px-6 py-12">
    <Link href={"/dashboard/sites/" + id} className="text-teal-800">← Explorar CMS</Link>
    <h1 className="mt-6 text-3xl font-semibold">Valores de {view.site.display_name}</h1>
    {error && <p role="alert" className="mt-5 text-amber-800">{error === "scope" ? "Escolha CMS, pelo menos um tipo de informação e de 1 a 20 coleções." : "Não foi possível preparar o scan. Confira a conexão Webflow e tente novamente."}</p>}
    {view.missingMigration ? <p role="status" className="mt-8 rounded border bg-amber-50 p-5">A configuração de scans está pendente. Aplique a terceira migration indicada no guia de scans.</p> : <>
      <section className="mt-8 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Encontrar informações repetidas</h2>
        <p className="mt-3 leading-7 text-slate-600">Escolha onde e o que buscar antes de iniciar. Selecionar menos coleções reduz o tempo de leitura.</p>
        <form action={previewScan} className="mt-5 space-y-6">
          <input type="hidden" name="id" value={randomUUID()} /><input type="hidden" name="siteId" value={id} />
          <fieldset className="space-y-3"><legend className="mb-3 font-semibold">Onde buscar?</legend>
            <label className="flex gap-2"><input type="radio" name="source" value="cms" required />CMS — textos, números, links, imagens e galerias</label>
            <label className="flex gap-2 text-slate-500"><input type="radio" disabled />Páginas estáticas — ainda não disponível</label>
            <p className="text-sm text-slate-600">Este scan não lê o conteúdo das páginas estáticas.</p>
          </fieldset>
          <fieldset className="space-y-3"><legend className="mb-3 font-semibold">O que você quer encontrar?</legend>
            {detectionTypes.map((type) => <label key={type} className="flex gap-2"><input type="checkbox" name="types" value={type} />{detectionLabels[type]}</label>)}
            <p className="text-sm text-slate-600">Selecione pelo menos um tipo ou informe um texto específico abaixo. Todos os itens das coleções escolhidas precisam ser lidos.</p>
          </fieldset>
          <div className="space-y-2">
            <label htmlFor="search-text" className="block font-semibold">Texto específico (opcional)</label>
            <input id="search-text" name="searchText" maxLength={200} placeholder="Ex.: Empresa Acme" className="w-full rounded border px-3 py-2" aria-describedby="search-text-help" />
            <p id="search-text-help" className="text-sm text-slate-600">Busca o trecho exato em texto simples e Rich Text, diferenciando maiúsculas e minúsculas. Ao preencher, a detecção de textos passa a procurar este trecho, que poderá ser substituído sem alterar o restante do parágrafo. Outros tipos selecionados continuam sendo pesquisados.</p>
            <p className="text-sm text-slate-600">No Rich Text, o trecho precisa estar contínuo, sem tags ou entidades HTML no meio. Campos acima de 2.000 caracteres ficam fora do scan. Apenas valores com duas ou mais ocorrências formam grupos de edição.</p>
          </div>
          <fieldset className="space-y-3"><legend className="mb-3 font-semibold">Quais coleções? (1 a 20)</legend>
            {collections === null ? <p role="alert">Não foi possível carregar as coleções. Confira a conexão e atualize a página.</p> : collections.length === 0 ? <p>Nenhuma coleção disponível.</p> : collections.map((c) => <label key={c.id} className="flex gap-2"><input type="checkbox" name="collectionIds" value={c.id} />{c.displayName}</label>)}
          </fieldset>
          <button disabled={!collections?.length} className="rounded bg-teal-800 px-4 py-3 text-white disabled:opacity-50">Preparar scan</button>
        </form>
      </section>
      <section className="mt-10"><h2 className="text-xl font-semibold">Scans recentes</h2>
        {!view.scans.length ? <p className="mt-3 text-slate-600">Nenhum scan preparado.</p> :
          <ul className="mt-4 space-y-3">{view.scans.map((scan) => <li key={scan.id} className="rounded border bg-white p-4"><Link className="text-teal-800 underline" href={"/dashboard/scans/" + scan.id}>Abrir scan · {new Date(scan.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</Link>
            <ul aria-label="Tipos pesquisados" className="mt-3 flex flex-wrap gap-2">{searchedScanTypes(scan).map((type) => <li key={type} className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900">{detectionLabels[type]}</li>)}</ul>
            {scan.plan[0]?.searchText && <p className="mt-2 break-words text-sm">Texto específico: “{scan.plan[0].searchText}”</p>}
            <p className="mt-2 text-sm">{scan.status} · {scan.items_read} itens · {scan.occurrences_count} ocorrências</p></li>)}</ul>}
      </section>
      <section className="mt-10"><h2 className="text-xl font-semibold">Alterações no CMS</h2>
        {!view.changes.length ? <p className="mt-3 text-slate-600">Nenhuma prévia de alteração preparada.</p> : <ul className="mt-4 space-y-3">{view.changes.map((change) => <li key={change.id} className="rounded border bg-white p-4"><Link href={"/dashboard/changes/" + change.id} className="text-teal-800 underline">Abrir alterações · {new Date(change.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</Link><p className="mt-2 text-sm">{change.status} · {change.cursor} de {change.total} campos processados</p></li>)}</ul>}
      </section>
      <section className="mt-10"><h2 className="text-xl font-semibold">Managed Values</h2>
        {!view.values.length ? <p className="mt-3 text-slate-600">Nenhum valor centralizado cadastrado. Os scans permitem editar ocorrências diretamente com prévia e confirmação.</p> :
          <ul className="mt-4 space-y-3">{view.values.map((value) => <li key={value.id} className="rounded border bg-white p-4"><Link className="font-semibold text-teal-800 underline" href={"/dashboard/managed-values/" + value.id}>{value.name}</Link><p className="mt-2 break-words">{valueLabel(value.canonical)}</p></li>)}</ul>}
      </section>
    </>}
  </main>;
}
