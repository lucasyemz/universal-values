import { FreshLink } from "@/components/ui/fresh-link";
import { notFound } from "next/navigation";
import { getWorkspacePreview } from "@/modules/workspaces/service";
import { confirmWorkspace } from "@/modules/workspaces/actions";
import { PageHeader, Steps } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const preview = await getWorkspacePreview((await params).id);
  if (!preview) notFound();
  return <main className="ui-page !max-w-2xl">
    <FreshLink href="/dashboard" >← Workspaces</FreshLink>
    <PageHeader title="Revisar workspace" description="Confira o nome. Você poderá conectar seus sites depois da criação." />
    <Steps steps={["Nomear workspace", "Revisar e criar"]} current={1} />
    <section className="mt-6 ui-card p-6">
      <h2 className="text-xl font-semibold">{preview.name}</h2>
      <p className="mt-4 leading-7 text-muted">Será criado um workspace com este nome, com você como proprietário. A criação ficará registrada no histórico.</p>
      {preview.workspace_id ? <p role="status" className="mt-6 text-accent">Esta criação já foi concluída.</p> : preview.expired ? <p role="alert" className="mt-6 text-amber-800">Esta prévia expirou. Volte e revise uma nova criação.</p> :
        <form action={confirmWorkspace} className="mt-6 space-y-5">
          <input type="hidden" name="id" value={preview.id} />
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="mt-1" />Confirmo a criação do workspace com o nome acima.</label>
          <SubmitButton pendingLabel="Criando workspace…">Confirmar criação</SubmitButton>
        </form>}
    </section>
  </main>;
}
