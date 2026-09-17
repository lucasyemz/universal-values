"use client";
import { useActionState } from "react";
import { authorizeDesigner } from "@/modules/static-text/dashboard-actions";

export function DesignerAuthorization({ id, siteId, name }: { id: string; siteId: string; name: string }) {
  const [state, action, pending] = useActionState(authorizeDesigner, {});
  return <section className="ui-card p-6"><h2 className="text-lg font-semibold">Conectar a extensão</h2>
    <p className="mt-2 text-sm text-muted">Autorizar por 8 horas o acesso ao histórico e o registro de prévias e resultados de páginas estáticas de <strong>{name}</strong>. As alterações continuam exigindo confirmação dentro do Designer.</p>
    {state.code ? <div className="mt-4"><label className="text-sm font-medium">Copie este código e cole na extensão<input readOnly value={state.code} onFocus={event => event.currentTarget.select()} className="mt-2 w-full font-mono text-xs" /></label><p className="mt-2 text-xs text-muted">Este código dá acesso ao site indicado. Não compartilhe. Ele só é exibido nesta tela após a autorização.</p></div> : <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="siteId" value={siteId} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" required /> Revisei o site e autorizo esta conexão temporária.</label>
      <button disabled={pending} className="ui-btn ui-btn-primary">{pending ? "Autorizando…" : "Gerar código de conexão"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>}
  </section>;
}
