import { randomUUID } from "node:crypto";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { loadAvailableSites, webflowMessage } from "@/modules/sites/service";
import { previewSiteConnection } from "@/modules/sites/actions";

export default async function ConnectionPage({ params, searchParams }: {
  params: Promise<{ connectionId: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { connectionId } = await params;
  const { error } = await searchParams;
  let view;
  try { view = await loadAvailableSites(connectionId); }
  catch (cause) {
    unstable_rethrow(cause);
    return <main className="mx-auto max-w-3xl px-6 py-12"><Link href="/dashboard" className="text-teal-800 underline">Voltar aos workspaces</Link><p role="alert" className="mt-6">{webflowMessage(cause)}</p></main>;
  }
  return <main className="mx-auto max-w-3xl px-6 py-12">
    <Link href={"/dashboard/workspaces/" + view.connection.workspace_id + "/sites"} className="text-sm text-teal-800">← Sites do workspace</Link>
    <h1 className="mt-6 text-3xl font-semibold">Escolha um site</h1>
    <p className="mt-3 text-slate-600">Estes sites foram disponibilizados pela autorização do Webflow.</p>
    {error && <p role="alert" className="mt-4 text-amber-800">Não foi possível preparar o vínculo. Atualize a lista e tente novamente.</p>}
    {!view.sites.length && <p className="mt-8">Nenhum site foi autorizado. Volte e inicie uma nova conexão selecionando um site no Webflow.</p>}
    <ul className="mt-8 space-y-4">{view.sites.map((site) => <li key={site.id} className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold">{site.displayName}</h2><p className="mt-1 text-sm text-slate-500">{site.shortName}</p>
      <form action={previewSiteConnection} className="mt-4">
        <input type="hidden" name="id" value={randomUUID()} /><input type="hidden" name="connectionId" value={connectionId} /><input type="hidden" name="siteId" value={site.id} />
        <button className="rounded bg-teal-800 px-4 py-2 text-white">Revisar vínculo</button>
      </form>
    </li>)}</ul>
  </main>;
}
