"use client";
import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useText } from "@/i18n/use-text";

export function ConfirmationDialog({ title, children, tone = "primary", disabled = false, busy = false, onOpen }: {
 title: string; children: ReactNode; tone?: "primary" | "danger"; disabled?: boolean; busy?: boolean; onOpen?: () => void;
}) {
 const dialog = useRef<HTMLDialogElement>(null), heading = useId(), t = useText();
 const pending = () => busy || !!dialog.current?.querySelector('[aria-busy="true"]');
 const close = () => { if (!pending()) dialog.current?.close(); };
 return <>
  <button type="button" disabled={disabled || busy} className={`ui-btn ui-btn-${tone}`} onClick={() => { onOpen?.(); dialog.current?.showModal(); }}>{title}</button>
  <dialog ref={dialog} aria-labelledby={heading} onCancel={event => { if (pending()) event.preventDefault(); }} className={`confirmation-dialog confirmation-dialog-${tone} m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border bg-white p-6 text-ink shadow-xl backdrop:bg-slate-900/40`}>
   <header className="mb-5 flex items-center justify-between gap-4"><h2 id={heading} className="text-lg font-semibold">{title}</h2><button autoFocus type="button" disabled={busy} onClick={close} className="ui-btn ui-btn-ghost p-2" aria-label={t("Fechar")}><X size={18} aria-hidden="true"/></button></header>
   <div className="space-y-4">{children}</div>
   <footer className="mt-5 flex justify-end border-t pt-4"><button type="button" disabled={busy} onClick={close} className="ui-btn">{t("Voltar")}</button></footer>
  </dialog>
 </>;
}
