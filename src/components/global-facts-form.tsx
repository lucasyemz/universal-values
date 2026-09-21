"use client";

import { useText } from "@/i18n/use-text";
import { useActionState } from "react";
import { previewFacts } from "@/modules/global-facts/actions";
import { factFields, type GlobalFacts } from "@/modules/global-facts/schema";
import { Notice } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export function GlobalFactsForm({ id, siteId, version, facts }: { id: string; siteId: string; version: number; facts: GlobalFacts }) {
  const t = useText();

  const [state, action] = useActionState(previewFacts, {});
  return <form action={action} className="space-y-6">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="siteId" value={siteId} /><input type="hidden" name="baseVersion" value={version} />
    {state.error && <Notice tone="danger">{t(state.error)}</Notice>}
    {factFields.map(field => {
      const value = facts[field.key];
      const fieldId = "fact-" + field.key;
      return <div key={field.key}>
        <label htmlFor={fieldId} className="block text-sm font-semibold">{t(field.label)}</label>
        <p id={fieldId + "-help"} className="mb-2 mt-1 text-xs leading-5 text-muted">{t(field.help)}</p>
        <textarea id={fieldId} name={field.key} aria-describedby={fieldId + "-help"} defaultValue={Array.isArray(value) ? value.join("\n") : value} required={"required" in field && field.required} maxLength={field.max} rows={field.key === "businessName" ? 1 : 3} className="w-full rounded-lg border bg-surface p-3 text-sm" />
      </div>;
    })}
    <p className="text-xs text-muted">{t("Listas aceitam até 20 valores. Campos vazios não ativam regras. Esta etapa salva uma prévia por 15 minutos; a referência só muda após confirmação.")}</p>
    <SubmitButton pendingLabel={t("Salvando prévia…")}>{t("Revisar")} {version ? t("nova versão") : t("primeira versão")}</SubmitButton>
  </form>;
}
