import Link from "next/link";
import type { ReactNode } from "react";
import { ScanLine, ArrowLeft, ArrowRight } from "lucide-react";
import { SiteContext } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui";
import { PAGE_SIZE } from "@/modules/sites/presentation";

export function SitePage({ site, title, description, newScan = false, children }: { site: { id: string; workspace_id: string; display_name: string }; title: string; description: string; newScan?: boolean; children: ReactNode }) {
  return <main className="ui-page"><SiteContext title={site.display_name} siteId={site.id} workspaceId={site.workspace_id} /><PageHeader eyebrow={site.display_name} title={title} description={description} actions={newScan ? <Link href={`/dashboard/sites/${site.id}/scans/new`} className="ui-btn ui-btn-primary"><ScanLine size={16} aria-hidden="true" />Novo scan</Link> : undefined} />{children}</main>;
}
export function SitePagination({ page, total, hasMore, base, query = {} }: { page: number; total?: number; hasMore?: boolean; base: string; query?: Record<string,string> }) {
  const href = (number: number) => base + "?" + new URLSearchParams({ ...query, page: String(number) });
  return <nav aria-label="Paginação" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-muted tabular-nums">Página {page}{total !== undefined ? ` · ${total} registros` : ""}</p><div className="flex gap-2">{page>1 && <Link className="ui-btn" href={href(page-1)}><ArrowLeft size={14} />Anterior</Link>}{(hasMore ?? (page*PAGE_SIZE<(total??0))) && <Link className="ui-btn" href={href(page+1)}>Próxima<ArrowRight size={14} /></Link>}</div></nav>;
}
