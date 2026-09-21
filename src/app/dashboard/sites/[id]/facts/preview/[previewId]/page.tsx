import { FreshLink } from "@/components/ui/fresh-link";
import Link from "next/link";
import { SiteContext } from "@/components/layout/app-shell";
import { Diff, Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { factDisplay, factFields } from "@/modules/global-facts/schema";
import { loadFactsPreview } from "@/modules/global-facts/service";
import { archiveFactsPreview, confirmFacts } from "@/modules/global-facts/actions";

export default async function FactsPreviewPage({ params, searchParams }: { params: Promise<{ id: string; previewId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id, previewId } = await params;
  const { site, preview, before, expired, stale } = await loadFactsPreview(id, previewId);
  const { error } = await searchParams;
  const base = `/dashboard/sites/${id}/facts`;
  return <main className="ui-page">
    <SiteContext title={site.display_name} siteName={site.display_name} siteId={id} workspaceId={site.workspace_id} />
    <FreshLink href={base}>← Global Facts</FreshLink>
    <PageHeader title={`Revisar versão ${preview.base_version + 1}`} eyebrow={site.display_name} description="Confira a referência inteira. A confirmação registra uma nova versão, sem modificar o site." />
    {error && <Notice tone="danger">{error === "archive" ? "Não foi possível arquivar. Confira a migration 011 e se a prévia ainda não foi confirmada." : "Não foi possível confirmar. Confira se a prévia foi arquivada, expirou ou ficou desatualizada."}</Notice>}
    {factFields.map(field => <section className="mb-6" key={field.key}><h2 className="font-semibold">{field.label}</h2><Diff before={before ? factDisplay(before, field.key) : "Sem referência aprovada"} after={factDisplay(preview.facts, field.key)} /></section>)}
    {preview.archived_at ? <Notice>Prévia arquivada em {new Date(preview.archived_at).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC. Mantida para consulta; não pode ser confirmada.</Notice> : preview.confirmed_version ? <Notice tone="success">Esta prévia já foi confirmada como versão {preview.confirmed_version}. <Link className="underline" href={`${base}/versions/${preview.confirmed_version}`}>Ver versão</Link></Notice> : stale ? <Notice tone="warning">Outra versão foi aprovada desde a criação desta prévia. Volte ao cadastro e prepare uma nova revisão.</Notice> : expired ? <Notice tone="warning">A prévia expirou. Volte ao cadastro para gerar outra.</Notice> : <form action={confirmFacts} className="ui-card space-y-5 p-6">
      <input type="hidden" name="id" value={preview.id} /><input type="hidden" name="siteId" value={id} />
      <p className="text-sm text-muted">Válida até {new Date(preview.expires_at).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC.</p>
      <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="confirmed" value="yes" required />Confirmo que revisei os fatos e sua fonte e aprovo esta versão como referência para este site.</label>
      <SubmitButton pendingLabel="Confirmando…">Confirmar referência</SubmitButton>
    </form>}
    {!preview.confirmed_version && !preview.archived_at && <details className="ui-card mt-6 p-6" id="archive"><summary className="cursor-pointer font-semibold">Arquivar esta prévia</summary>
      <form action={archiveFactsPreview} className="mt-4 space-y-4">
        <input type="hidden" name="id" value={preview.id} /><input type="hidden" name="siteId" value={id} />
        <p className="text-sm text-muted">A prévia acima sairá de Pendentes e ficará em Arquivadas para consulta. Seus valores e histórico serão preservados; ela não poderá mais ser confirmada. Nenhuma versão aprovada será alterada.</p>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="confirmed" value="yes" required />Confirmo o arquivamento desta prévia.</label>
        <SubmitButton variant="secondary" pendingLabel="Arquivando…">Confirmar arquivamento</SubmitButton>
      </form>
    </details>}
  </main>;
}
