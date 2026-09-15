import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspacePreview } from "@/modules/workspaces/service";
import { confirmWorkspace } from "@/modules/workspaces/actions";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const preview = await getWorkspacePreview((await params).id);
  if (!preview) notFound();
  return <main className="mx-auto max-w-lg px-6 py-16">
    <Link href="/dashboard" className="text-sm text-teal-800">← Workspaces</Link>
    <h1 className="mt-8 text-3xl font-semibold">Revisar criação</h1>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">{preview.name}</h2>
      <p className="mt-4 leading-7 text-slate-600">Será criado um workspace com este nome, com você como proprietário. A criação ficará registrada no histórico.</p>
      {preview.workspace_id ? <p role="status" className="mt-6 text-teal-800">Esta criação já foi concluída.</p> : preview.expired ? <p role="alert" className="mt-6 text-amber-800">Esta prévia expirou. Volte e revise uma nova criação.</p> :
        <form action={confirmWorkspace} className="mt-6 space-y-5">
          <input type="hidden" name="id" value={preview.id} />
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="mt-1" />Confirmo a criação do workspace com o nome acima.</label>
          <button className="rounded bg-teal-800 px-4 py-3 font-medium text-white">Confirmar criação</button>
        </form>}
    </section>
  </main>;
}
