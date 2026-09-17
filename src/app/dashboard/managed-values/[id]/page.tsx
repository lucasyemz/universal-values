import Link from "next/link";
import { loadManagedValue } from "@/modules/scans/service";
import { valueLabel } from "@/modules/scans/schema";

export default async function ManagedValuePage({ params }: { params: Promise<{ id: string }> }) {
  const { value, bindings } = await loadManagedValue((await params).id);
  return <main className="mx-auto max-w-3xl px-6 py-12">
    <Link className="text-teal-800" href={"/dashboard/sites/" + value.site_id + "/scans"}>← Scans e valores</Link>
    <h1 className="mt-6 text-3xl font-semibold">{value.name}</h1>
    <p className="mt-4 break-words text-2xl text-teal-800">{valueLabel(value.canonical)}</p>
    <p className="mt-4 text-slate-600">Managed Value criado com {bindings.length} fontes vinculadas. A edição e sincronização com o Webflow estarão disponíveis em uma próxima etapa.</p>
    <ul className="mt-8 space-y-4">{bindings.map((binding) => <li key={binding.id} className="rounded-xl border bg-white p-5">
      <h2 className="font-semibold">{binding.field_slug}</h2>
      <p className="mt-2 break-all text-xs text-slate-500">Coleção {binding.collection_id} · Item {binding.item_id} · Locale {binding.locale || "padrão"}</p>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm">{binding.source_value}</p>
    </li>)}</ul>
  </main>;
}
