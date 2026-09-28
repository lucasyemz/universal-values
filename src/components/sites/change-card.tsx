import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { getText } from "@/i18n/server";
import { StatusBadge } from "@/components/ui";
import type { SiteActivity } from "@/modules/sites/page-service";
import { siteDate } from "@/modules/sites/presentation";

export async function ChangeCard({ row }: { row: SiteActivity }) {
  const t = await getText();
  return <li className="change-history-card">
    <div className="flex flex-wrap items-start gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><History size={25} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{t(row.title)}</h3><p className="mt-1 break-words text-xs text-muted">{row.source === "static" ? t("Página estática · ") : ""}{row.target}</p><p className="mt-1 text-xs text-muted">{siteDate(row.createdAt, t.dateLocale)}</p></div>
      <StatusBadge status={row.status} label={row.label} />
    </div>
    <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
      <div><p className="text-2xl font-semibold tabular-nums">{row.verified}<span className="text-base font-normal text-muted"> / {row.total}</span></p><p className="text-xs text-muted">{t("verificados")} · {row.source === "cms" ? t("campos") : t("elementos")}</p></div>
      <Link prefetch={false} className="ui-btn" href={row.href}>{t("Ver detalhes")}<ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
  </li>;
}
