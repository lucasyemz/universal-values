import { useText } from "@/i18n/use-text";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScanLine, ArrowLeft, ArrowRight } from "lucide-react";
import { SiteContext } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui";
import { PAGE_SIZE } from "@/modules/sites/presentation";

export function SitePage({ site, title, description, newScan = false, newScanHref, children }: { site: { id: string; workspace_id: string; display_name: string }; title: string; description: string; newScan?: boolean; newScanHref?: string; children: ReactNode }) {
  const t = useText();

  return <main className="ui-page"><SiteContext title={title} siteName={site.display_name} siteId={site.id} workspaceId={site.workspace_id} /><PageHeader eyebrow={site.display_name} title={title} description={description} actions={newScan ? <Link prefetch={false} href={newScanHref ?? `/dashboard/sites/${site.id}/scans/new`} className="ui-btn ui-btn-primary"><ScanLine size={16} aria-hidden="true" />{t("Novo scan")}</Link> : undefined} />{children}</main>;
}
export function SitePagination({ page, total, hasMore, base, query = {} }: { page: number; total?: number; hasMore?: boolean; base: string; query?: Record<string,string> }) {
  const t = useText();

  const href = (number: number) => base + "?" + new URLSearchParams({ ...query, page: String(number) });
  return <nav aria-label={t("Paginação")} className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-muted tabular-nums">{t("Página")} {page}{total !== undefined ? t(" · {0} registros", total) : ""}</p><div className="flex gap-2">{page>1 && <Link className="ui-btn" href={href(page-1)}><ArrowLeft size={14} />{t("Anterior")}</Link>}{(hasMore ?? (page*PAGE_SIZE<(total??0))) && <Link className="ui-btn" href={href(page+1)}>{t("Próxima")}<ArrowRight size={14} /></Link>}</div></nav>;
}
