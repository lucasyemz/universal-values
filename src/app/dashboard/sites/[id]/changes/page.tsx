import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SitePage, SitePagination } from "@/components/sites/site-page";
import { DataTable, EmptyState, StatusBadge } from "@/components/ui";
import { siteChangesPage } from "@/modules/sites/page-service";
import { sitePageNumber, siteDate, changeFilterSchema } from "@/modules/sites/presentation";
export default async function ChangesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; filter?: string }> }) {
  const { id }=await params, query=await searchParams, page=sitePageNumber(query.page), filter=changeFilterSchema.catch('all').parse(query.filter);
  const view=await siteChangesPage(id,page,filter),base=`/dashboard/sites/${id}/changes`;
  return <SitePage site={view.site} title="Alterações" description="Consulte prévias e operações do CMS e das páginas estáticas.">
    <nav className="ui-tabs mb-6" aria-label="Filtrar alterações">{([['all','Todas'],['cms','CMS'],['static','Páginas estáticas'],['attention','Precisam de atenção']] as const).map(([value,label])=><Link key={value} className="ui-tab" aria-current={filter===value?'page':undefined} href={base+'?filter='+value}>{label}</Link>)}</nav>
    {view.limited && <p className="mb-4 text-xs text-muted">Falhas, conflitos e resultados incertos nas últimas 1.000 operações de cada origem.</p>}
    {!view.rows.length ? <EmptyState title="Nenhuma alteração neste filtro" description="As prévias e os resultados das operações aparecerão aqui." /> : <DataTable label="Histórico de alterações"><thead><tr><th>Operação / origem</th><th>Status</th><th>Verificados</th><th>Data</th><th><span className="sr-only">Abrir operação</span></th></tr></thead><tbody>{view.rows.map(row=><tr key={row.source+row.id} className="relative hover:bg-subtle/60 focus-within:bg-subtle"><td><Link href={row.href} className="font-medium after:absolute after:inset-0">{row.title}</Link><p className="mt-1 text-xs text-muted">{row.source==='static'?'Página estática · ':''}{row.target}</p></td><td><StatusBadge status={row.status} label={row.label} /></td><td className="whitespace-nowrap tabular-nums">{row.verified} / {row.total}<span className="mt-1 block text-xs text-muted">{row.source==='cms'?'campos':'elementos'}</span></td><td className="whitespace-nowrap text-sm tabular-nums">{siteDate(row.createdAt)}</td><td><ArrowUpRight size={16} aria-hidden="true" /></td></tr>)}</tbody></DataTable>}
    <SitePagination page={page} hasMore={view.hasMore} base={base} query={{filter}} />
    <p className="mt-5 text-xs text-muted">Verificados inclui conteúdo aplicado ou já atualizado. A publicação no Webflow é feita separadamente.</p>
  </SitePage>;
}
