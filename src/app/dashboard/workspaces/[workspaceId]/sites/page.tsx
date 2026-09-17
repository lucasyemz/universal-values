import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getWebflowConfig } from "@/connectors/webflow/config";
import { loadWorkspaceSites } from "@/modules/sites/service";
import { startWebflowConnection } from "@/modules/sites/actions";

export default async function WorkspaceSitesPage({ params, searchParams }: {
  params: Promise<{ workspaceId: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { workspaceId } = await params;
  const view = await loadWorkspaceSites(workspaceId);
  const configured = !!getWebflowConfig();
  const { error } = await searchParams;
  return <main className="mx-auto max-w-4xl px-6 py-12">
    <Link href="/dashboard" className="text-sm text-teal-800">← Workspaces</Link>
    <h1 className="mt-6 text-3xl font-semibold">{view.name}</h1>
    <p className="mt-3 text-slate-600">Sites conectados · CMS Webflow</p>
    {error && <p role="alert" className="mt-6 rounded border border-amber-200 bg-amber-50 p-4">{error === "denied" ? "A autorização foi cancelada no Webflow." : "A conexão não foi concluída. Confira as permissões e inicie uma nova autorização."}</p>}
    {view.missingMigration ? <p role="status" className="mt-8 rounded border border-amber-200 bg-amber-50 p-5">A configuração de sites ainda está pendente. Aplique a migration Webflow indicada no README para continuar.</p> : <>
      <section aria-label="Sites conectados" className="mt-8">
        {view.sites.length ? <ul className="grid gap-4 sm:grid-cols-2">{view.sites.map((site) => <li key={site.id} className="rounded-xl border bg-white p-6">
          <h2 className="font-semibold">{site.display_name}</h2>
          <Link className="mt-3 inline-block text-teal-800 underline" href={"/dashboard/sites/" + site.id}>Explorar CMS</Link>
        </li>)}</ul> : <p className="text-slate-600">Nenhum site vinculado a este workspace.</p>}
      </section>
      {view.connections.length > 0 && <section className="mt-8"><h2 className="font-semibold">Autorizações disponíveis</h2><ul className="mt-3 space-y-2">{view.connections.map((connection, index) => <li key={connection.id}><Link className="text-teal-800 underline" href={"/dashboard/connections/" + connection.id}>Selecionar site da autorização {index + 1}</Link></li>)}</ul></section>}
      <section className="mt-10 max-w-xl rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Conectar Webflow</h2>
        <p className="mt-3 leading-7 text-slate-600">Você autorizará a leitura de sites e a leitura e edição do CMS. Alterações exigem uma prévia e sua confirmação no app; o site não será publicado automaticamente. Depois, revise qual site será vinculado a este workspace.</p>
        {!configured ? <p role="status" className="mt-5 text-sm text-amber-800">A integração precisa ser configurada antes da primeira conexão. Siga o guia Webflow no README.</p> :
          <form action={startWebflowConnection} className="mt-6 space-y-5">
            <input type="hidden" name="id" value={randomUUID()} /><input type="hidden" name="workspaceId" value={workspaceId} />
            <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="confirmed" value="yes" required />Autorizo conectar o Webflow com leitura de sites e leitura e escrita no CMS para este workspace.</label>
            <button className="rounded bg-teal-800 px-4 py-3 font-medium text-white">Continuar no Webflow</button>
          </form>}
      </section>
    </>}
  </main>;
}
