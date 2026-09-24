"use client";
import { scanDisplayStatus } from "@/modules/scans/list-summary";
import type { ScanListRow } from "@/modules/scans/list-summary";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, FileText, ImageIcon, Link2, RotateCw, ScanLine, Search } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { StatusBadge, EmptyState } from "@/components/ui";
import { RememberedLink } from "@/components/layout/navigation-state";
import { ScanCollectionCell } from "./collection-cell";
import { detectionLabels, searchedScanTypes } from "@/modules/scans/schema";
import { filterScanHistory, type ScanReviewCounts } from "@/modules/scans/history-filter";
import { siteDate } from "@/modules/sites/presentation";

export function ScanHistoryList({ scans, links, counts }: { scans: ScanListRow[]; links: Record<string, string>; counts: Record<string, ScanReviewCounts | null> }) {
 const t = useText();
 const [filter, setFilter] = useState<"all" | "pending" | "reviewed">("all");
 const [query, setQuery] = useState("");
 const labels = Object.fromEntries(scans.map(scan => [scan.id, searchedScanTypes(scan).map(type => t(type === "text" && scan.plan.some(entry => entry.placeholders) ? "Textos de exemplo" : detectionLabels[type])).join(", ")]));
 const visible = filterScanHistory(scans, counts, labels, query, filter);
 return <>
  <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
   <div className="ui-tabs" role="group" aria-label={t("Filtrar scans nesta página")}>{([{id:"all",label:t("Todos os scans")},{id:"pending",label:t("Precisam de revisão")},{id:"reviewed",label:t("Revisados")}] as const).map(tab => <button key={tab.id} type="button" aria-pressed={filter === tab.id} onClick={() => setFilter(tab.id)} className="ui-tab">{tab.label}</button>)}</div>
   <label className="relative block w-full sm:w-72"><span className="sr-only">{t("Buscar scans nesta página")}</span><Search size={17} className="pointer-events-none absolute left-3 top-3 text-muted" aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Buscar scans…")} className="w-full pl-10!" /></label>
  </div>
  <p role="status" className="mb-4 text-xs text-muted">{t("Busca e filtros nesta página: {0} de {1} scans.", visible.length, scans.length)}</p>
  {!visible.length ? <EmptyState title={t("Nenhum scan corresponde aos filtros")} description={t("Altere a busca, selecione todos os scans ou navegue para outra página.")} /> : <ul className="space-y-3">{visible.map(scan => {
   const types=searchedScanTypes(scan), Icon=types.length===1 ? types[0]==="image" ? ImageIcon : types[0]==="link" ? Link2 : FileText : ScanLine;
   const review=counts[scan.id], href=links[scan.id]!;
   return <li key={scan.id} className="scan-history-card">
    <div className="flex min-w-0 items-center gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={25} aria-hidden="true" /></span><div className="min-w-0"><RememberedLink href={href} className="break-words font-semibold hover:text-accent">{scan.plan[0]?.searchText ? `“${scan.plan[0].searchText}”` : labels[scan.id]}</RememberedLink>{scan.plan[0]?.searchText && <p className="mt-1 text-xs text-muted">{labels[scan.id]}</p>}</div></div>
    <div className="min-w-0 space-y-2"><p className="flex items-center gap-2 text-xs text-muted"><CalendarDays size={15} className="shrink-0" aria-hidden="true" />{siteDate(scan.created_at,t.dateLocale)}</p><ScanCollectionCell scan={scan} href={href} /></div>
    <div className="scan-history-counts">{review ? <><Link prefetch={false} href={href + "?filter=pending"} className="scan-history-count"><span className={review.pending ? "bg-orange-50 text-orange-800" : "bg-subtle text-muted"}>{review.pending}</span>{t("Pendentes")}</Link><Link prefetch={false} href={href + "?filter=reviewed"} className="scan-history-count"><span className={review.reviewed ? "bg-accent-soft text-accent" : "bg-subtle text-muted"}>{review.reviewed}</span>{t("Revisados")}</Link></> : <span className="text-xs text-muted">{t("Contagens indisponíveis")}</span>}</div>
    <div><StatusBadge status={scanDisplayStatus(scan.status,review)} /></div>
    <div className="scan-history-actions"><RememberedLink href={href} className="ui-btn ui-btn-primary">{t("Revisar resultados")}<ArrowRight size={16} aria-hidden="true" /></RememberedLink>{["completed","limited","cancelled"].includes(scan.status) && scan.plan.length>0 && <Link prefetch={false} className="ui-btn" href={href.replace(/\/scans\/\d+$/, "/scans/new") + "?repeat=" + href.split("/").at(-1)}><RotateCw size={16} aria-hidden="true" />{t("Repetir scan")}</Link>}</div>
   </li>;
  })}</ul>}
 </>;
}
