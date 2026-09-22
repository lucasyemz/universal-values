"use client";
import { useText } from "@/i18n/use-text";
import { useActionState } from "react";
import { authorizeDesigner } from "@/modules/static-text/dashboard-actions";

export function DesignerAuthorization({ id, siteId, name }: { id: string; siteId: string; name: string }) {
  const t = useText();

  const [state, action, pending] = useActionState(authorizeDesigner, {});
  return <div className="min-w-64 max-w-md" aria-label={`${t("Conectar a extensão")} · ${name}`}>
    {state.code ? <div className="space-y-2"><label className="text-sm font-medium">{t("Copie este código e cole na extensão")}<input readOnly value={state.code} onFocus={event => event.currentTarget.select()} className="mt-2 w-full font-mono text-xs" /></label><p className="mt-2 text-xs text-muted">{t("Este código dá acesso ao site indicado. Não compartilhe. Ele só é exibido nesta tela após a autorização.")}</p></div> : <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="siteId" value={siteId} />
      <button type="submit" name="confirmed" value="on" disabled={pending} className="ui-btn ui-btn-primary">{pending ? t("Autorizando…") : t("Gerar código de conexão")}</button>
      {state.error && <p role="alert">{t(state.error)}</p>}
    </form>}
  </div>;
}
