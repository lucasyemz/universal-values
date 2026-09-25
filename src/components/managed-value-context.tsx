"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ManagedValueEditor } from "@/components/managed-value-editor";
import { X } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { loadManagedContext } from "@/modules/managed-values/context-actions";
import { valueLabel } from "@/modules/scans/schema";
export function ManagedValueContext({ siteId, valueId, edit = false }: { siteId: string; valueId: string; edit?: boolean }) {
  const t = useText(), dialog = useRef<HTMLDialogElement>(null), request = useRef(0);
  const [view, setView] = useState<Awaited<ReturnType<typeof loadManagedContext>> | null>(null);
  const [loading, setLoading] = useState(false);
  async function load(page: number) {
    const current = ++request.current; setLoading(true);
    try { const next = await loadManagedContext({ siteId, valueId, page }); if (current === request.current) setView(next); }
    catch { if (current === request.current) setView({ ok: false }); }
    finally { if (current === request.current) setLoading(false); }
  }
  return <>
    <button type="button" className="ui-btn relative z-10 text-xs" onClick={() => { dialog.current?.showModal(); void load(1); }}>{t(edit ? "Editar" : "Ver fontes")}</button>
    <dialog ref={dialog} aria-label={t("Origens vinculadas")} className="m-auto max-h-[90dvh] w-[min(56rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border bg-white p-5 text-ink shadow-lg backdrop:bg-black/25" onClose={() => { request.current++; setLoading(false); }}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{view?.ok ? view.value.name : t("Origens vinculadas")}</h2><button type="button" autoFocus className="ui-btn" aria-label={t("Fechar")} onClick={() => dialog.current?.close()}><X size={18}/></button></div>
      {loading && <div role="status" className="space-y-3"><p>{t("Carregando fontes…")}</p><div aria-hidden="true" className="h-24 animate-pulse rounded bg-subtle motion-reduce:animate-none"/></div>}
      {view && !view.ok && <div role="alert"><p>{t("Não foi possível carregar as fontes.")}</p><button className="ui-btn mt-3" onClick={() => void load(1)}>{t("Tentar novamente")}</button></div>}
      {view?.ok && <>
        <p className="break-words font-semibold text-accent">{valueLabel(view.value.canonical)}</p>
        <p className="my-3 text-xs text-muted">{t("Último conteúdo registrado de cada fonte. Conflitos preservam o registro anterior.")} {t("Os registros não garantem o conteúdo atual do Webflow.")}</p>
        {edit && (view.total <= 50 && !view.disabled ? <ManagedValueEditor key={view.value.id + ":" + view.value.version} id={valueId} valueId={valueId} version={view.value.version} canonical={view.value.canonical} disabled={view.disabled} /> : <p role="status" className="my-4 text-sm text-muted">{t("Abra a Variável para conferir operações ativas, arquivamento ou mais de 50 fontes antes de editar.")}</p>)}
        <ul className="space-y-3" aria-busy={loading}>{view.sources.map(source => <li key={source.id} className="rounded-lg border p-4"><p className="font-semibold">{source.field}{source.locale && ` · ${source.locale}`}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{source.value}</p><p className="mt-2 text-xs text-muted">{source.uncertain ? t("Resultado incerto") : source.verifiedAt ? new Date(source.verifiedAt).toLocaleString(t.dateLocale, { timeZone: "UTC" }) + " UTC" : t("Registro inicial do scan")}</p><details className="mt-2 text-xs"><summary>{t("Detalhes da origem")}</summary><p className="break-all">{t("Coleção")}: {source.collection} · Item: {source.item}</p></details></li>)}</ul>
        <nav aria-label={t("Paginação")} className="my-4 flex flex-wrap items-center gap-3"><span className="text-sm">{t("Página")} {view.page} · {view.total} {t("fontes")}</span><button type="button" className="ui-btn" disabled={loading || view.page === 1} onClick={() => void load(view.page - 1)}>{t("Anterior")}</button><button type="button" className="ui-btn" disabled={loading || !view.hasMore} onClick={() => void load(view.page + 1)}>{t("Próxima")}</button></nav>
        <Link prefetch={false} href={view.href} className="ui-btn">{t("Abrir Variável")}</Link>
      </>}
    </dialog>
  </>;
}
