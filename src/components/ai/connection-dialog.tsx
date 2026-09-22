"use client";
import { useText } from "@/i18n/use-text";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { AiSettings } from "./settings";

export function AiConnectionDialog({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const t = useText();

  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40">
    <div className="flex items-center justify-between gap-4 border-b p-5"><h2 id={title} className="text-lg font-semibold">{t("Conectar IA")}</h2><button type="button" onClick={onClose} className="ui-btn ui-btn-ghost" aria-label={t("Fechar conexão de IA")}><X size={18} aria-hidden="true" /></button></div>
    <div className="p-4"><AiSettings onConnected={onConnected} /></div>
  </dialog>;
}
