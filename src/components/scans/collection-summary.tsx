import type { ReactNode } from "react";
import { ScanCollectionCell } from "./collection-cell";
import { getText } from "@/i18n/server";
import type { Scan } from "@/modules/scans/schema";
import { scanCollectionSummary } from "@/modules/scans/collection-summary";
export async function ScanCollectionSummary({scan,reviewCount,compact=false,children}:{scan:Scan;reviewCount:number;compact?:boolean;children?:ReactNode}) {
 const t=await getText(), collections=scanCollectionSummary(scan);
 return <section className={compact ? "text-sm" : "ui-card mt-4 p-4 text-sm"} aria-label={t("Coleções lidas ({0})",collections.length)}>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex flex-wrap items-center gap-3"><ScanCollectionCell scan={scan}/>{!compact && <><span className="text-muted">{t("{0} ocorrências na revisão",reviewCount)}</span><span className="text-muted">{t("{0} itens lidos",scan.items_read)}</span></>}</div>
   <p className="text-xs text-muted">{t("Scan iniciado em")} {new Date(scan.created_at).toLocaleString(t.dateLocale,{timeZone:"UTC"})} UTC</p>
  </div>
  {children}
 </section>;
}
