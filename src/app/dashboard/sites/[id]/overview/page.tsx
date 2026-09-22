import { getText } from "@/i18n/server";
import Link from "next/link";
import { CircleCheck, CircleAlert, ArrowUpRight } from "lucide-react";
import { SitePage } from "@/components/sites/site-page";
import { SectionHeader, StatusBadge, EmptyState } from "@/components/ui";
import { siteOverview } from "@/modules/sites/page-service";
import { siteDate } from "@/modules/sites/presentation";
export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getText();

  const {id}=await params,view=await siteOverview(id),base=`/dashboard/sites/${id}`;
  const attention=view.attention;
  return <SitePage site={view.site} title={t("Visão geral do site")} description={t("Acompanhe o conteúdo centralizado e os registros que precisam da sua atenção.")} newScan>
    <section aria-label={t("Resumo do site")} className="mb-8 grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      {label:t("Managed Values ativos"),value:view.activeValues,href:base+'/managed-values'},
      {label:t("Scans registrados"),value:view.scanCount,href:base+'/scans'},
      {label:t("Fontes incertas"),value:view.uncertainCount,href:base+'/managed-values'},
      {label:t("Último scan"),value:view.scans[0]?siteDate(view.scans[0].created_at, t.dateLocale):t("Ainda não realizado"),href:base+'/scans'},
    ].map(metric=><Link href={metric.href} key={metric.label} className="rounded-xl border bg-white p-5 hover:border-accent/40"><p className="text-xs text-muted">{metric.label}</p><p className="mt-3 text-xl font-semibold tabular-nums">{metric.value}</p></Link>)}</section>
    <section className="mb-10 rounded-xl border bg-white p-6"><div className="mb-4 flex items-center gap-2">{attention?<CircleAlert size={20} className="text-amber-700" />:<CircleCheck size={20} className="text-green-700" />}<h2 className="text-lg font-semibold">{attention?t("Precisa de atenção"):t("Nenhuma pendência encontrada neste resumo")}</h2></div>
      <ul className="space-y-3 text-sm">{view.running.map(scan=><li key={scan.id}><Link className="inline-flex items-center gap-2 underline" href={view.scanLinks[scan.id]!}>{scan.status==='paused'?t("Retomar scan pausado"):t("Acompanhar scan em andamento")}<ArrowUpRight size={14} /></Link></li>)}
      {view.uncertain.map((binding,index)=><li key={binding.managed_value_id+index}><Link className="underline" href={view.valueLinks[binding.managed_value_id]!}>{t("Conferir fonte com resultado incerto")}</Link></li>)}
      {view.recent.some(row=>row.attention)&&<li><Link href={base+'/changes?filter=attention'} className="underline">{t("Conferir falhas, conflitos ou resultados incertos")}</Link></li>}</ul>
      <p className="mt-3 text-xs text-muted">{t("Resumo dos registros salvos e das últimas cinco operações. Não é uma verificação em tempo real do Webflow; confira os resultados dos scans para revisar o conteúdo encontrado.")}</p>
    </section>
    <SectionHeader title={t("Atividade recente")} action={<Link className="ui-btn" href={base+'/changes'}>{t("Ver alterações")}</Link>} />
    {view.activity.length===0?<EmptyState title={t("Seu histórico começa com um scan")} description={t("Buscas e operações registradas aparecerão aqui.")} />:<ul className="divide-y rounded-xl border bg-white">{view.activity.map(row=><li key={row.id}><Link href={row.href} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-subtle/60"><div><p className="font-medium">{t(row.title)}</p><p className="mt-1 text-xs text-muted">{t(row.description)} · {siteDate(row.createdAt, t.dateLocale)}</p></div><StatusBadge status={row.status} label={row.label} /></Link></li>)}</ul>}
  </SitePage>;
}
