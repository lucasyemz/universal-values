import { getText } from "@/i18n/server";
import { FreshLink } from "@/components/ui/fresh-link";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { loadSiteContent, webflowMessage } from "@/modules/sites/service";
import { safeOffset } from "@/modules/sites/schema";
import { PageHeader, Notice, StatusBadge, EmptyState, DataTable } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { ScanLine } from "lucide-react";

export default async function SitePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ collection?: string; offset?: string }>;
}) {
  const t = await getText();

  const { id } = await params;
  const query = await searchParams;
  let view;
  try { view = await loadSiteContent(id, query.collection, safeOffset(query.offset)); }
  catch (cause) {
    unstable_rethrow(cause);
    return <main className="ui-page"><FreshLink href="/dashboard" >{t("Voltar aos workspaces")}</FreshLink><PageHeader title={t("Explorar CMS")} /><Notice tone="danger">{t(webflowMessage(cause))}</Notice><FreshLink className="ui-btn mt-4" href={"/dashboard/sites/" + id + "/cms"}>{t("Tentar novamente")}</FreshLink></main>;
  }
  const siteBase = "/dashboard/sites/" + id;
  const base = siteBase + "/cms";
  return <main className="ui-page">
    <SiteContext title={view.site.display_name} siteName={view.site.display_name} siteId={id} workspaceId={view.site.workspace_id} />
    <FreshLink href={"/dashboard/workspaces/" + view.site.workspace_id + "/sites"} >{t("← Sites do workspace")}</FreshLink>
    <PageHeader title={t("Explorar CMS")} eyebrow={view.site.display_name} description={t("Consulte as coleções e os itens do CMS quando precisar.")} actions={<Link href={siteBase + "/scans/new"} className="ui-btn ui-btn-primary"><ScanLine size={16} />{t("Novo scan")}</Link>} />
    <Notice>{t("Conteúdo preparado no Webflow. Rascunhos e alterações ainda não publicadas podem aparecer aqui.")}</Notice>
    <section className="mt-8"><h2 className="text-xl font-semibold">{t("Coleções")}</h2>
      {!view.collections.length ? <EmptyState title={t("Nenhuma coleção disponível")} description={t("Confira as coleções e as permissões desta autorização no Webflow antes de iniciar um scan.")} /> :
        <nav aria-label={t("Coleções")} className="ui-tabs mt-4">{view.collections.map((collection) => <Link key={collection.id} href={base + "?collection=" + collection.id} aria-current={view.details?.id === collection.id ? "page" : undefined} className="ui-tab">{collection.displayName}</Link>)}</nav>}
    </section>
    {view.details && view.page && <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">{view.details.displayName}</h2>
      <details className="mt-4 rounded border bg-white p-4"><summary className="cursor-pointer font-medium">{t("Campos da coleção (")}{view.details.fields.length})</summary>
        <ul className="mt-4 space-y-2">{view.details.fields.map((field) => <li key={field.id}>{field.displayName} <span className="text-sm text-faint">({field.type})</span></li>)}</ul>
      </details>
      <p className="mt-6 text-sm text-muted">{view.page.pagination.total}  {t("itens · mostrando")} {view.page.items.length}  {t("nesta página.")}</p>
      {!view.page.items.length && <EmptyState title={t("Nenhum item nesta página")} description={t("Escolha outra coleção ou volte à primeira página.")} action={view.page.pagination.offset > 0 ? <Link className="ui-btn" href={base + "?collection=" + view.details.id}>{t("Primeira página")}</Link> : undefined} /> }
      <div className="mt-4"><DataTable label={t("Itens do CMS")}><thead><tr><th>Item</th><th>{t("Estado")}</th><th>{t("Conteúdo")}</th></tr></thead><tbody>{view.page.items.map((item) => <tr key={item.id + ":" + (item.cmsLocaleId ?? "")}>
        <td className="min-w-44 align-top"><h3 className="font-semibold">{typeof item.fieldData.name === "string" ? item.fieldData.name : item.id}</h3>{item.cmsLocaleId && <p className="mt-2 break-all text-xs text-muted">Locale: {item.cmsLocaleId}</p>}</td>
        <td className="align-top"><StatusBadge status={item.isDraft ? "draft" : "ready"} label={item.isDraft ? t("Rascunho") : t("Preparado")} />{item.isArchived && <p className="mt-2 text-xs text-muted">{t("Arquivado")}</p>}</td>
        <td className="min-w-64"><details><summary className="font-medium text-accent">{t("Ver campos do item")}</summary><dl className="mt-4 space-y-4">{Object.entries(item.fieldData).map(([field, value]) => <div key={field}><dt className="text-xs font-semibold text-muted">{view.details!.fields.find((f) => f.slug === field)?.displayName ?? field}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{typeof value === "string" || typeof value === "number" ? String(value) : typeof value === "boolean" ? t(value ? "Sim" : "Não") : value === null ? t("Não informado") : <details><summary className="text-xs text-muted">{t("Ver dados estruturados")}</summary><pre className="mt-2 whitespace-pre-wrap break-all text-xs">{JSON.stringify(value, null, 2)}</pre></details>}</dd></div>)}</dl></details></td>
      </tr>)}</tbody></DataTable></div>
      <nav aria-label={t("Paginação de itens")} className="mt-6 flex gap-6">
        {view.page.pagination.offset > 0 && <Link className="ui-btn" href={base + "?collection=" + view.details.id + "&offset=" + Math.max(0, view.page.pagination.offset - 25)}>{t("Anterior")}</Link>}
        {view.page.pagination.offset + view.page.pagination.limit < view.page.pagination.total && <Link className="ui-btn" href={base + "?collection=" + view.details.id + "&offset=" + (view.page.pagination.offset + view.page.pagination.limit)}>{t("Próxima")}</Link>}
      </nav>
    </section>}
  </main>;
}
