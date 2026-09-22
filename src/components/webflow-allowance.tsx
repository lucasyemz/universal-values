"use client";
import { useState, useTransition } from "react";
import { useText } from "@/i18n/use-text";
import { checkWebflowAllowance } from "@/modules/plans/provider-actions";
export function WebflowAllowance({ siteId }: { siteId: string }) {
  const t = useText();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkWebflowAllowance>> | undefined>();
  return <div className="space-y-2"><button type="button" className="ui-btn" disabled={pending} onClick={() => start(async () => {
    try { setResult(await checkWebflowAllowance(siteId)); } catch { setResult(null); }
  })}>{pending ? t("Consultando…") : t("Consultar saldo Webflow")}</button>
  <p className="text-sm text-muted" aria-live="polite">{result === null ? t("Saldo indisponível. Confira a conexão e tente novamente.") : result ? t("{0} de {1} requisições restantes no minuto, observado às {2}.", result.remaining, result.limit, new Date(result.checkedAt).toLocaleTimeString(t.dateLocale)) : t("A consulta usa uma requisição. O saldo pode ser compartilhado com outras integrações.")}</p></div>;
}
