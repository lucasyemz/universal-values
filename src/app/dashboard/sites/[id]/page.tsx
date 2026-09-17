import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { loadSiteContent, webflowMessage } from "@/modules/sites/service";
import { safeOffset } from "@/modules/sites/schema";

export default async function SitePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ collection?: string; offset?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  let view;
  try { view = await loadSiteContent(id, query.collection, safeOffset(query.offset)); }
  catch (cause) {
    unstable_rethrow(cause);
    return <main className="mx-auto max-w-3xl px-6 py-12"><Link href="/dashboard" className="text-teal-800 underline">Voltar aos workspaces</Link><p role="alert" className="mt-6">{webflowMessage(cause)}</p></main>;
  }
  const base = "/dashboard/sites/" + id;
  return <main className="mx-auto max-w-5xl px-6 py-12">
    <Link href={"/dashboard/workspaces/" + view.site.workspace_id + "/sites"} className="text-sm text-teal-800">← Sites do workspace</Link>
    <h1 className="mt-6 text-3xl font-semibold">{view.site.display_name}</h1>
    <Link href={base + "/scans"} className="mt-4 inline-block rounded bg-teal-800 px-4 py-3 text-white">Scans e Managed Values</Link>
    <p className="mt-3 text-slate-600">Explorador do CMS · conteúdo preparado no Webflow, que pode diferir do site publicado.</p>
    <section className="mt-8"><h2 className="text-xl font-semibold">Coleções</h2>
      {!view.collections.length ? <p className="mt-4 text-slate-600">Este site não possui coleções disponíveis.</p> :
        <nav aria-label="Coleções" className="mt-4 flex flex-wrap gap-3">{view.collections.map((collection) => <Link key={collection.id} href={base + "?collection=" + collection.id} aria-current={query.collection === collection.id ? "page" : undefined} className="rounded border border-slate-200 bg-white px-4 py-3 text-teal-800 aria-[current=page]:border-teal-700">{collection.displayName}</Link>)}</nav>}
    </section>
    {view.details && view.page && <section className="mt-10">
      <h2 className="text-2xl font-semibold">{view.details.displayName}</h2>
      <details className="mt-4 rounded border bg-white p-4"><summary className="cursor-pointer font-medium">Campos da coleção ({view.details.fields.length})</summary>
        <ul className="mt-4 space-y-2">{view.details.fields.map((field) => <li key={field.id}>{field.displayName} <span className="text-sm text-slate-500">({field.type})</span></li>)}</ul>
      </details>
      <p className="mt-6 text-sm text-slate-600">{view.page.pagination.total} itens · mostrando {view.page.items.length} nesta página.</p>
      <ul className="mt-4 space-y-4">{view.page.items.map((item) => <li key={item.id + ":" + (item.cmsLocaleId ?? "")} className="rounded-xl border bg-white p-5">
        <h3 className="font-semibold">{typeof item.fieldData.name === "string" ? item.fieldData.name : item.id}</h3>
        <p className="mt-2 text-xs text-slate-500">{item.isDraft ? "Rascunho" : "Conteúdo preparado"}{item.isArchived ? " · Arquivado" : ""}{item.cmsLocaleId ? " · Locale: " + item.cmsLocaleId : ""}</p>
        <dl className="mt-4 space-y-3">{Object.entries(item.fieldData).map(([field, value]) => <div key={field}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{view.details!.fields.find((f) => f.slug === field)?.displayName ?? field}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl>
      </li>)}</ul>
      <nav aria-label="Paginação de itens" className="mt-6 flex gap-6">
        {view.page.pagination.offset > 0 && <Link className="text-teal-800 underline" href={base + "?collection=" + view.details.id + "&offset=" + Math.max(0, view.page.pagination.offset - 25)}>Anterior</Link>}
        {view.page.pagination.offset + view.page.pagination.limit < view.page.pagination.total && <Link className="text-teal-800 underline" href={base + "?collection=" + view.details.id + "&offset=" + (view.page.pagination.offset + view.page.pagination.limit)}>Próxima</Link>}
      </nav>
    </section>}
  </main>;
}
