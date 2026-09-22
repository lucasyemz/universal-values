import { selectionStateKey } from "@/modules/navigation/state";
import { useText } from "@/i18n/use-text";
import { randomUUID } from "node:crypto";
import { previewManagedValue } from "@/modules/scans/actions";
import { centralizationOptions, type LinkedValues } from "@/modules/scans/centralization";
import type { Occurrence } from "@/modules/scans/schema";
import { SubmitButton } from "@/components/ui/submit-button";

export function CentralizeValue({ scanId, occurrences, linkedValues }: { scanId: string; occurrences: Occurrence[]; linkedValues: LinkedValues }) {
  const t = useText();

  const { available, eligible } = centralizationOptions(occurrences, linkedValues);
  return <details data-state-key={"centralize:" + occurrences[0]?.id} className="rounded-lg border p-4">
    <summary className="cursor-pointer font-medium text-accent">{t("Centralizar valor")}</summary>
    <p className="mt-3 text-sm text-muted">{t("Crie um Managed Value para atualizar este dado em suas fontes vinculadas. Selecione apenas ocorrências que representam a mesma informação de negócio. A marcação de conferência é independente.")}</p>
    {!eligible ? <p className="mt-3 text-sm">{t("Selecione ocorrências pendentes em pelo menos dois campos não gerenciados. Para atualizar um valor vinculado, abra seu Managed Value.")}</p> : <form action={previewManagedValue} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={randomUUID()} />
      <input type="hidden" name="scanId" value={scanId} />
      <label className="block text-sm font-medium">{t("Nome do valor central")} <input name="name" required minLength={2} maxLength={80} placeholder={t("Ex.: Telefone comercial")} className="mt-2 block w-full rounded border p-3" />
      </label>
      <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">{t("Origens que serão vinculadas")}</legend>
        {available.map(o => <label key={o.id} className="flex items-start gap-3 rounded border p-3 text-sm">
          <input data-selection-key={selectionStateKey(o.id, o.source_value, o.start_pos, o.end_pos)} type="checkbox" name="occurrenceIds" value={o.id} className="mt-1" />
          <span>{o.collection_name} → {o.item_name} → {o.field_name}<span className="mt-1 block break-words text-muted">{o.raw_match}  {t("· posição")} {o.start_pos} · locale {o.locale || t("padrão")}</span></span>
        </label>)}
      </fieldset>
      <p className="text-xs text-muted">{t("Selecione de 2 a 100 ocorrências em pelo menos dois campos. Esta ação usa o valor registrado no scan; não salva alterações digitadas no editor abaixo e não modifica o Webflow.")}</p>
      <SubmitButton pendingLabel={t("Preparando prévia…")}>{t("Revisar centralização")}</SubmitButton>
    </form>}
  </details>;
}
