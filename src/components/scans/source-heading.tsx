import { useText } from "@/i18n/use-text";
import type { Occurrence } from "@/modules/scans/schema";
import type { SourceLabel } from "@/modules/managed-values/source-labels";

/** Saved display labels only; the operation's immutable source identity stays intact. */
export function SourceHeading({ occurrence: o, label }: { occurrence: Occurrence; label?: SourceLabel }) {
  const t = useText();
  const item = label?.item_name || (o.item_name !== o.item_id ? o.item_name : "") || t("Item sem nome registrado");
  const collection = label?.collection_name || (o.collection_name !== o.collection_id ? o.collection_name : "") || t("Coleção sem nome registrado");
  const field = label?.field_name || o.field_name.replace(/[-_]+/g, " ");
  return <header>
    <h2 className="break-words font-semibold">{item}</h2>
    <p className="mt-1 break-words text-sm text-muted">{collection} → {field}</p>
    <details className="mt-2 text-xs text-muted">
      <summary>{t("Detalhes da origem")}</summary>
      <p className="mt-2 break-all">Collection ID: {o.collection_id} · Item ID: {o.item_id} · Field: {o.field_slug}</p>
      <p className="break-all">Locale ID: {o.locale || t("padrão")}</p>
    </details>
  </header>;
}
