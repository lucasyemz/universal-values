import Link from "next/link";
import { loadSitePreview } from "@/modules/sites/service";
import { confirmSiteConnection } from "@/modules/sites/actions";

export default async function SitePreviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const preview = await loadSitePreview((await params).id);
  const { error } = await searchParams;
  return <main className="mx-auto max-w-xl px-6 py-12">
    <Link className="text-sm text-teal-800" href={"/dashboard/connections/" + preview.connection_id}>← Escolher site</Link>
    <h1 className="mt-6 text-3xl font-semibold">Revisar vínculo</h1>
    <section className="mt-6 rounded-xl border bg-white p-6">
      <h2 className="text-xl font-semibold">{preview.display_name}</h2>
      <p className="mt-3 text-sm text-slate-500">ID Webflow: {preview.webflow_site_id}</p>
      <p className="mt-4 leading-7 text-slate-600">Este site ficará disponível para consultar coleções, campos e itens do CMS neste workspace. {preview.expected_connection_id ? "A confirmação substituirá a conexão de leitura atual deste site." : "A confirmação criará um novo vínculo de leitura."} A operação ficará registrada no histórico.</p>
      {error && <p role="alert" className="mt-4 text-amber-800">Não foi possível confirmar. O site pode ter mudado, a autorização pode ter expirado ou a prévia ficou desatualizada. Volte e revise o vínculo novamente.</p>}
      {preview.site_id ? <Link className="mt-6 inline-block text-teal-800 underline" href={"/dashboard/sites/" + preview.site_id}>Vínculo concluído. Explorar CMS</Link> : preview.expired ? <p role="alert" className="mt-6 text-amber-800">A prévia expirou. Volte e gere uma nova.</p> :
        <form action={confirmSiteConnection} className="mt-6 space-y-5">
          <input type="hidden" name="id" value={preview.id} />
          <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="confirmed" value="yes" required />Confirmo o vínculo de leitura deste site.</label>
          <button className="rounded bg-teal-800 px-4 py-3 font-medium text-white">Confirmar vínculo</button>
        </form>}
    </section>
  </main>;
}
