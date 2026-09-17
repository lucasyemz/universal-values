import Link from "next/link";
import { loadManagedValue } from "@/modules/scans/service";
import { valueLabel } from "@/modules/scans/schema";
import { PageHeader, SectionHeader, Notice, DataTable } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";

export default async function ManagedValuePage({ params }: { params: Promise<{ id: string }> }) {
  const { value, bindings } = await loadManagedValue((await params).id);
  return <main className="ui-page">
    <SiteContext title={value.name} siteId={value.site_id} />
    <Link className="text-accent" href={"/dashboard/sites/" + value.site_id + "/scans"}>← Scans e valores</Link>
    <PageHeader eyebrow="Managed Value" title={value.name} description={`${bindings.length} fontes vinculadas · Criado em ${new Date(value.created_at).toLocaleDateString("pt-BR")}`} />
    <section aria-label="Valor centralizado" className="ui-card p-6"><p className="text-xs font-medium text-muted">Valor cadastrado</p><p className="mt-2 break-words text-2xl font-semibold text-accent">{valueLabel(value.canonical)}</p></section>
    <Notice>Este cadastro organiza as fontes observadas. A edição e sincronização do Managed Value ainda não estão disponíveis. Para alterações pontuais, use os resultados de um novo scan.</Notice>
    <section className="mt-8"><SectionHeader title="Origens vinculadas" description="Conteúdo registrado no momento da criação do valor." /><DataTable label="Origens vinculadas"><thead><tr><th>Campo</th><th>Conteúdo observado</th><th>Origem</th></tr></thead><tbody>{bindings.map((binding) => <tr key={binding.id}><td className="font-mono text-xs">{binding.field_slug}</td><td className="max-w-lg whitespace-pre-wrap break-words">{binding.source_value}</td><td><details><summary className="text-xs text-accent">Detalhes da origem</summary><p className="mt-2 max-w-xs break-all font-mono text-xs text-muted">Coleção {binding.collection_id}<br />Item {binding.item_id}<br />Locale {binding.locale || "padrão"}</p></details></td></tr>)}</tbody></DataTable></section>
  </main>;
}
