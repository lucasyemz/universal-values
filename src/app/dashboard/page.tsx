import { randomUUID } from "node:crypto";
import { requireUser } from "@/modules/auth/service";
import { logout } from "@/modules/auth/actions";
import { listWorkspaces } from "@/modules/workspaces/service";
import { previewWorkspace } from "@/modules/workspaces/actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const { user } = await requireUser();
  const workspaces = await listWorkspaces();
  const params = await searchParams;
  return <main className="mx-auto max-w-4xl px-6 py-12">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl font-semibold">Seus workspaces</h1>
      <details className="text-sm"><summary className="cursor-pointer">{user.email} · Sessão</summary>
        <form action={logout} className="mt-3 rounded border bg-white p-4"><p>Sair desta sessão neste navegador?</p><button className="mt-3 font-semibold text-teal-800">Confirmar saída</button></form>
      </details>
    </header>
    {params.error && <p role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-4">Não foi possível concluir a operação. Confira os dados e gere uma nova prévia se necessário.</p>}
    {params.created && <p role="status" className="mt-6 text-teal-800">Workspace criado. A operação foi registrada no histórico.</p>}
    <section aria-label="Workspaces disponíveis" className="mt-8">
      {workspaces.length === 0 ? <p className="text-slate-600">Você ainda não participa de um workspace.</p> :
        <ul className="grid gap-4 sm:grid-cols-2">{workspaces.map((workspace) => <li key={workspace.id} className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{workspace.name}</h2><p className="mt-2 text-sm text-slate-500">Conexão Webflow disponível em uma próxima etapa.</p></li>)}</ul>}
    </section>
    <form action={previewWorkspace} className="mt-10 max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Criar workspace</h2>
      <p className="text-sm leading-6 text-slate-600">Um espaço para organizar os sites da sua equipe. Você será o proprietário. Revise o nome na próxima etapa antes de confirmar.</p>
      <input type="hidden" name="id" value={randomUUID()} />
      <label className="block text-sm font-medium">Nome<input name="name" required minLength={2} maxLength={80} className="mt-2 block w-full rounded border border-slate-300 p-3" placeholder="Minha empresa" /></label>
      <button className="rounded bg-teal-800 px-4 py-3 font-medium text-white">Revisar criação</button>
    </form>
  </main>;
}
