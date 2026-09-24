import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("overview");
}

import { siteLink } from "@/modules/routes/links";
import { QuickSearch } from "@/components/sites/quick-search";
import { savedQuerySchema } from "@/modules/scans/saved-search";
import { getText } from "@/i18n/server";
import Link from "next/link";
import { CircleCheck, CircleAlert, ArrowUpRight, ArrowRight, FileText, History, Info, Database, TriangleAlert, Compass, ChevronRight } from "lucide-react";
import { SitePage } from "@/components/sites/site-page";
import { StatusBadge, EmptyState } from "@/components/ui";
import { siteOverview } from "@/modules/sites/page-service";
import { siteDate } from "@/modules/sites/presentation";
export default async function OverviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const t = await getText();

  const {id}=await params,view=await siteOverview(id),base=await siteLink(id);
  const attention=view.attention;
  const query = savedQuerySchema.parse((await searchParams).q ?? "");
  return <SitePage site={view.site} title={t("Visão geral do site")} description={t("Acompanhe o conteúdo centralizado e os registros que precisam da sua atenção.")} newScan newScanHref={base + "/scans/new"}>
    <QuickSearch siteId={id} query={query} base={base} />
    <section aria-label={t("Resumo do site")} className="mb-6 grid divide-y overflow-hidden rounded-2xl border bg-white md:grid-cols-3 md:divide-x md:divide-y-0">{[
      { label: t("Managed Values ativos"), value: view.activeValues, href: base + '/managed-values', Icon: Database },
      { label: t("Scans registrados"), value: view.scanCount, href: base + '/scans', Icon: FileText },
      { label: t("Fontes incertas"), value: view.uncertainCount, href: base + '/managed-values', Icon: TriangleAlert },
    ].map(({ label, value, href, Icon }) => <Link prefetch={false} href={href} key={label} className="flex min-w-0 items-center gap-4 px-5 py-6 transition-colors hover:bg-accent-soft focus-visible:-outline-offset-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={29} aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm font-medium text-muted">{label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p></div></Link>)}</section>
    <section className="mb-10 rounded-xl border bg-white p-6"><div className="mb-4 flex items-center gap-2">{attention?<CircleAlert size={20} className="text-amber-700" />:<CircleCheck size={20} className="text-green-700" />}<h2 className="text-lg font-semibold">{attention?t("Precisa de atenção"):t("Nenhuma pendência encontrada neste resumo")}</h2></div>
      <ul className="space-y-3 text-sm">{view.running.map(scan=><li key={scan.id}><Link className="inline-flex items-center gap-2 underline" href={view.scanLinks[scan.id]!}>{scan.status==='paused'?t("Retomar scan pausado"):t("Acompanhar scan em andamento")} · Scan #{view.scanLinks[scan.id]!.split("/").at(-1)}<ArrowUpRight size={14} /></Link></li>)}
      {view.uncertain.map((binding,index)=><li key={binding.managed_value_id+index}><Link className="underline" href={view.valueLinks[binding.managed_value_id]! + "#managed-sources"}>{t("Conferir fonte com resultado incerto")}</Link></li>)}
      {view.recent.filter(row=>row.attention).map(row=><li key={row.id}><Link prefetch={false} href={row.href} className="inline-flex flex-wrap items-center gap-2 underline">{t(row.title)} · {row.target} · {siteDate(row.createdAt,t.dateLocale)}<StatusBadge status={row.status} label={row.label}/></Link></li>)}</ul>
      <p className="mt-3 text-xs text-muted">{t("Resumo dos registros salvos e das últimas cinco operações. Não é uma verificação em tempo real do Webflow; confira os resultados dos scans para revisar o conteúdo encontrado.")}</p>
    </section>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <section aria-labelledby="recent-scans-heading" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="recent-scans-heading" className="text-lg font-semibold">{t("Scans recentes")}</h2><Link prefetch={false} className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline" href={base + '/scans'}>{t("Ver todos os scans")}<ArrowRight size={15} aria-hidden="true" /></Link></div>
        {!view.scans.length ? <EmptyState title={t("Seu histórico começa com um scan")} description={t("Buscas e operações registradas aparecerão aqui.")} /> : <ul className="space-y-3">{view.scans.slice(0, 3).map(scan => <li key={scan.id} className="rounded-xl border bg-white p-5">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><FileText size={23} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="font-semibold">{t("Scan do CMS")} #{view.scanLinks[scan.id]!.split('/').at(-1)}</h3><p className="mt-1 text-xs text-muted">{siteDate(scan.created_at, t.dateLocale)}</p></div><StatusBadge status={scan.status} /></div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-2xl font-semibold tabular-nums">{scan.occurrences_count}</p><p className="text-xs text-muted">{t("ocorrências")}</p></div><Link prefetch={false} className="ui-btn" href={view.scanLinks[scan.id]!}>{t("Ver resultados")}<ArrowRight size={15} aria-hidden="true" /></Link></div>
        </li>)}</ul>}
      </section>
      <section aria-labelledby="recent-changes-heading" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="recent-changes-heading" className="text-lg font-semibold">{t("Alterações recentes")}</h2><Link prefetch={false} className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline" href={base + '/changes'}>{t("Ver todas as alterações")}<ArrowRight size={15} aria-hidden="true" /></Link></div>
        {!view.recent.length ? <EmptyState title={t("Nenhuma alteração registrada")} description={t("As alterações do CMS e do Designer aparecerão aqui.")} /> : <ul className="space-y-3">{view.recent.slice(0, 3).map(row => <li key={row.id} className="rounded-xl border bg-white p-5">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><History size={23} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="font-semibold">{t(row.title)}</h3><p className="mt-1 break-words text-xs text-muted">{row.target} · {siteDate(row.createdAt, t.dateLocale)}</p></div><StatusBadge status={row.status} label={row.label} /></div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-2xl font-semibold tabular-nums">{row.verified}<span className="text-base font-normal text-muted"> / {row.total}</span></p><p className="text-xs text-muted">{t("verificados")}</p></div><Link prefetch={false} className="ui-btn" href={row.href}>{t("Ver detalhes")}<ArrowRight size={15} aria-hidden="true" /></Link></div>
        </li>)}</ul>}
      </section>
    </div>
    <p className="mt-6 flex items-start gap-3 rounded-xl bg-accent-soft p-4 text-sm text-muted"><Info size={19} className="shrink-0 text-accent" aria-hidden="true" />{t("Esta visão geral usa registros salvos. Inicie um novo scan para consultar o conteúdo atual do CMS.")}</p>
    <section aria-labelledby="manage-site-heading" className="mt-8">
      <h2 id="manage-site-heading" className="mb-4 text-xl font-semibold">{t("Gerenciar este site")}</h2>
      <div className="grid gap-4 lg:grid-cols-2">{[
        { title: t("Managed Values"), description: t("Mantenha o conteúdo compartilhado organizado."), href: base + '/managed-values', Icon: Database },
        { title: t("Explorar CMS"), description: t("Navegue pelas coleções deste site."), href: base + '/cms', Icon: Compass },
      ].map(({ title, description, href, Icon }) => <Link key={href} href={href} prefetch={false} className="group flex min-w-0 items-center gap-4 rounded-2xl border bg-white p-6 transition-colors hover:border-accent hover:bg-accent-soft"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={30} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="text-base font-semibold">{title}</h3><p className="mt-1 text-sm text-muted">{description}</p></div><ChevronRight size={22} className="shrink-0 text-muted group-hover:text-accent" aria-hidden="true" /></Link>)}</div>
    </section>
  </SitePage>;
}
