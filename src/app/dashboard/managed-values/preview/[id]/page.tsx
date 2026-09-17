import { OccurrenceHeading } from "@/components/scans/occurrence-heading";
import Link from "next/link";
import { loadValuePreview } from "@/modules/scans/service";
import { confirmManagedValue } from "@/modules/scans/actions";
import { valueLabel } from "@/modules/scans/schema";

export default async function ValuePreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { preview, occurrences, expired } = await loadValuePreview(id);
  const { error } = await searchParams;
  return <main className="mx-auto max-w-3xl px-6 py-12">
    <Link className="text-teal-800" href={"/dashboard/scans/" + preview.scan_id}>← Sugestões do scan</Link>
    <h1 className="mt-6 text-3xl font-semibold">Revisar Managed Value</h1>
    <section className="mt-8 rounded-xl border bg-white p-6">
      <h2 className="text-xl font-semibold">{preview.name}</h2><p className="mt-3 text-sm">Valor encontrado que será mantido:</p><p className="mt-2 break-words">{valueLabel(preview.canonical)}</p>
      <p className="mt-4 leading-7 text-slate-600">Serão criados o valor e seus vínculos com as fontes abaixo, usando o conteúdo observado no scan. Esta etapa organiza as fontes; a atualização no Webflow será implementada posteriormente.</p>
      <Link className="mt-4 inline-block text-teal-800 underline" href={"/dashboard/scans/" + preview.scan_id}>Manter como está e voltar sem criar</Link>
      <ul className="mt-5 space-y-3">{occurrences.map((o) => <li className="rounded border p-3" key={o.id}><p className="font-medium">{o.collection_name} → {o.item_name} → {o.field_name}</p><p className="mt-2 break-words"><OccurrenceHeading occurrence={o} /></p></li>)}</ul>
      {error && <p role="alert" className="mt-5 text-amber-800">Não foi possível confirmar. A prévia pode ter expirado ou uma fonte já foi vinculada. Volte ao scan e revise a seleção.</p>}
      {preview.managed_value_id ? <Link className="mt-6 inline-block text-teal-800 underline" href={"/dashboard/managed-values/" + preview.managed_value_id}>Abrir Managed Value criado</Link> : expired ? <p className="mt-6 text-amber-800">Prévia expirada. Prepare uma nova seleção.</p> :
        <form action={confirmManagedValue} className="mt-6 space-y-4"><input type="hidden" name="id" value={id} /><label className="flex gap-3"><input type="checkbox" name="confirmed" value="yes" required />Confirmo que estas fontes representam o mesmo dado de negócio.</label><button className="rounded bg-teal-800 px-4 py-3 text-white">Criar Managed Value</button></form>}
    </section>
  </main>;
}
