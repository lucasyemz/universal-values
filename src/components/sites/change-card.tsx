import { RecordCard, RecordHeading } from "@/components/ui/record-card";
import { ActivityValue } from "@/components/sites/activity-value";
import { ResourceNumber } from "@/components/ui/resource-number";
import { CollectionTags } from "@/components/scans/collection-cell";
import { detectionLabels } from "@/modules/scans/schema";
import Link from "next/link";
import { ArrowRight, CalendarDays, History } from "lucide-react";
import { getText } from "@/i18n/server";
import { StatusBadge } from "@/components/ui";
import type { SiteActivity } from "@/modules/sites/page-service";
import { siteDate } from "@/modules/sites/presentation";

export async function ChangeCard({ row, horizontal = false }: { row: SiteActivity; horizontal?: boolean }) {
  const t = await getText();
  const types = row.details?.types ?? [];
  return <RecordCard compact={!horizontal}>
    <RecordHeading icon={<History size={25} aria-hidden="true" />}
      title={row.reference?.after !== undefined ? <ActivityValue value={row.reference.after} imageUrl={row.reference.imageUrl ?? (row.source === "static" && types.length === 1 && types[0] === "image" ? row.reference.after : undefined)} heading /> : <span>{types.length ? types.map(type => t(detectionLabels[type])).join(", ") : t(row.title)}</span>}
      subtitle={<>{row.reference?.after !== undefined && <>{t("activity.newValue")} · </>}{types.length ? types.map(type => t(detectionLabels[type])).join(", ") : t(row.title)} · <ResourceNumber href={row.href} inline /></>}
      status={<StatusBadge status={row.status} label={row.label} />} />
    <div className="record-metadata"><div className="record-scope">
      <p className="flex items-center gap-2 text-sm text-muted"><CalendarDays size={17} aria-hidden="true" />{siteDate(row.createdAt, t.dateLocale)}</p>
      <span className="text-sm text-muted">{row.source === "static" ? t("Página estática · ") : ""}{row.target}</span>
      {row.source === "cms" && !!row.details?.collections.length && <CollectionTags collections={row.details.collections} />}
    </div></div>
    <div className="record-footer">
      {row.reference?.after !== undefined && <p className="text-xs text-muted">{t("activity.detailsHint")}</p>}
      <div className="record-actions"><Link prefetch={false} className="ui-btn ui-btn-primary" href={row.href}>{t("Ver detalhes")}<ArrowRight size={16} aria-hidden="true" /></Link></div>
    </div>
  </RecordCard>;
}
