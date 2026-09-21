import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SitePage, SitePagination } from "@/components/sites/site-page";
import { DataTable, EmptyState } from "@/components/ui";
import { siteValuesPage } from "@/modules/sites/page-service";
import { sitePageNumber, siteSearchSchema, valueFilterSchema } from "@/modules/sites/presentation";
import { valueLabel, detectionLabels } from "@/modules/scans/schema";

export default async function ValuesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; q?: string; filter?: string }> }) {
  const { id } = await params, query = await searchParams; const page=sitePageNumber(query.page), filter=valueFilterSchema.catch("active").parse(query.filter), q=siteSearchSchema.parse(query.q??"");
  const view=await siteValuesPage(id,page,q,filter), base=`/dashboard/sites/${id}/managed-values`;
  return <SitePage site={view.site} title="Managed Values" description="Gerencie o conteúdo que você atualiza com frequência, em um só lugar.">
    <form method="get" className="mb-5 flex flex-wrap items-end gap-3"><input type="hidden" name="filter" value={filter} /><label className="flex-1 text-sm font-medium">Buscar por nome<input key={q} name="q" type="search" defaultValue={q} maxLength={200} placeholder="Ex.: Telefone comercial" className="mt-2 block w-full" /></label><button className="ui-btn">Buscar</button>{q && <Link className="ui-btn ui-btn-ghost" href={base+"?filter="+filter}>Limpar</Link>}</form>
    <nav aria-label="Filtrar valores" className="ui-tabs mb-6">{([['active','Ativos'],['archived','Arquivados'],['all','Todos']] as const).map(([value,label])=><Link key={value} className="ui-tab" aria-current={filter===value?'page':undefined} href={base+'?'+new URLSearchParams({filter:value,q})}>{label}</Link>)}</nav>
    {!view.values.length ? <EmptyState title={q ? "Nenhum valor encontrado" : "Nenhum Managed Value neste filtro"} description="Crie um valor a partir das ocorrências encontradas em um scan." action={<Link className="ui-btn" href={`/dashboard/sites/${id}/scans`}>Ver scans</Link>} /> : <DataTable label="Managed Values"><thead><tr><th>Nome</th><th>Valor atual</th><th>Fontes</th><th>Tipo</th><th>Estado</th><th><span className="sr-only">Abrir valor</span></th></tr></thead><tbody>{view.values.map(value=><tr key={value.id} className="relative hover:bg-subtle/60 focus-within:bg-subtle"><td><Link href={`/dashboard/managed-values/${value.id}`} className="font-medium after:absolute after:inset-0">{value.name}</Link></td><td><span className="block max-w-64 truncate text-sm text-muted" title={valueLabel(value.canonical)}>{valueLabel(value.canonical)}</span></td><td className="tabular-nums">{view.sources?.[value.id]?.count ?? "—"}</td><td className="text-sm text-muted">{detectionLabels[value.canonical.type]}</td><td className="text-sm">{value.archived_at?'Arquivado':view.sources?.[value.id]?.uncertain?'Conferir fontes':'Ativo'}</td><td><ArrowUpRight size={16} aria-hidden="true" /></td></tr>)}</tbody></DataTable>}
    {view.sources===null && <p role="status" className="mt-3 text-sm text-muted">Contagem de fontes indisponível. Abra o valor para consultar seus vínculos.</p>}
    <SitePagination page={page} total={view.total} base={base} query={{filter,q}} />
  </SitePage>;
}
