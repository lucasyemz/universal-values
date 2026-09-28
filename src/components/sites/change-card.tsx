import { CollectionTags } from "@/components/scans/collection-cell";
import { detectionLabels } from "@/modules/scans/schema";
import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { getText } from "@/i18n/server";
import { StatusBadge } from "@/components/ui";
import type { SiteActivity } from "@/modules/sites/page-service";
import { siteDate } from "@/modules/sites/presentation";

export async function ChangeCard({ row, horizontal = false }: { row: SiteActivity; horizontal?: boolean }) {
  const t = await getText();
  const types = row.details?.types ?? [];
  return <li className={"change-history-card" + (horizontal ? " change-history-card-horizontal" : "")}>
    <div className="flex flex-wrap items-start gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><History size={25} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{types.length ? types.map(type => t(detectionLabels[type])).join(", ") : t(row.title)}</h3><p className="mt-1 break-words text-xs text-muted">{row.source === "static" ? t("Página estática · ") : ""}{row.target}</p><p className="mt-1 text-xs text-muted">{siteDate(row.createdAt, t.dateLocale)}</p>{row.source === "cms" && !!row.details?.collections.length && <div className="mt-2"><CollectionTags collections={row.details.collections} /></div>}</div>
      <StatusBadge status={row.status} label={row.label} />
    </div>
    <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
      <Link prefetch={false} className="ui-btn" href={row.href}>{t("Ver detalhes")}<ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
  </li>;
}
