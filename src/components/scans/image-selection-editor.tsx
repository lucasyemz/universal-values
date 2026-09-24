"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import type { Occurrence } from "@/modules/scans/schema";
import { editableValue, fillOccurrenceValues, replacementValue } from "@/modules/scans/changes";
import { useText } from "@/i18n/use-text";
import { ImagePreview } from "./image-change-preview";
import { ReplacementInput } from "./replacement-input";

export function ImageSelectionEditor({ selected, inputs, onChange, disabled, errors }: {
  selected: Occurrence[]; inputs: Record<string, string>; onChange: (inputs: Record<string, string>) => void;
  disabled: boolean; errors: Record<string, string>;
}) {
  const t = useText();
  const value = (o: Occurrence) => inputs[o.id] ?? editableValue(o.canonical);
  const [individual, setIndividual] = useState(() => new Set(selected.map(value)).size > 1);
  const groups = individual ? selected.map(o => [o]) : [selected];
  return <div className="space-y-4">
    {selected.length > 1 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={individual} disabled={disabled} onChange={event => {
      const next = event.target.checked;
      if (!next) onChange(fillOccurrenceValues(selected, inputs, value(selected[0]!)));
      setIndividual(next);
    }}/>{t("Editar valores individualmente")}</label>}
    {groups.map(group => {
      const first = group[0]!;
      const next = value(first);
      const valid = replacementValue(first.canonical, next).success;
      const itemNames = [...new Set(group.map(o => o.item_name))].join(" · ");
      return <section key={first.id}>
        <header className="mb-3 min-w-0">
          <h4 className="truncate text-sm font-semibold" title={itemNames}>{itemNames}</h4>
        <ul className="mt-1 space-y-1 text-xs text-muted">{group.map(o => <li key={o.id}>{o.collection_name} → {o.item_name} → {o.field_name}</li>)}</ul>
        </header>
        <div className="rounded-lg border bg-surface p-3">
        <div className="image-comparison">
          <span className="image-comparison-before-label" aria-hidden="true"/>
          <label className="image-comparison-input block text-sm font-medium">{t("URL da nova imagem")}<ReplacementInput text={false} value={next} disabled={disabled} onChange={url => onChange(fillOccurrenceValues(group, inputs, url))} placeholder="https://…"/></label>
          <div className="image-comparison-before"><ImagePreview compactUrl url={editableValue(first.canonical)} label={t("Antes")} aligned/></div>
          <ArrowRight className="image-comparison-arrow text-ink" size={26} aria-hidden="true"/>
          <div className="image-comparison-after">
            {valid ? <ImagePreview compactUrl key={next.trim()} url={next.trim()} label={t("Depois")} aligned/> : <div className="image-comparison-empty"><p>{t("Informe uma URL válida para visualizar a nova imagem.")}</p></div>}
          </div>
        </div>
        {group.map(o => errors[o.id] ? <p key={o.id} role="alert" className="mt-3 text-sm text-red-700">{t(errors[o.id]!)}</p> : null)}
        </div>
      </section>;
    })}
  </div>;
}
