"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { ImageThumbnail } from "@/components/scans/image-thumbnail";
import { imageFilename } from "@/modules/scans/image-filename";
import { referenceExcerpt } from "@/modules/sites/activity-reference";

export function ActivityValue({ value, heading = false, imageUrl }: { value: string; heading?: boolean; imageUrl?: string }) {
  const t = useText();
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const text = useRef<HTMLElement>(null);
  const pinned = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const displayValue = imageUrl ? imageFilename(imageUrl) : value;
  const excerpt = referenceExcerpt(displayValue);
  const shortened = overflowing || [...displayValue.replace(/\s+/g, " ").trim()].length > 60;
  const close = () => { pinned.current = false; setOpen(false); };

  useEffect(() => {
    const node = text.current;
    if (!node) return;
    const measure = () => {
      const available = (root.current?.clientWidth ?? node.clientWidth) - (imageUrl ? 68 : 0) - 40;
      const range = document.createRange();
      range.selectNodeContents(node);
      setOverflowing(range.getBoundingClientRect().width > Math.max(0, available));
    };
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    measure();
    return () => observer.disconnect();
  }, [displayValue, shortened, imageUrl]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { close(); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div ref={root} className={heading ? "relative min-w-0" : "change-history-reference relative my-4 min-w-0 border-l-2 border-accent/20 pl-3 text-sm"}
    onMouseEnter={() => { if (shortened) setOpen(true); }}
    onMouseLeave={() => { if (!pinned.current) setOpen(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    {!heading && <p className="mb-1.5 text-xs font-medium text-muted">{t("activity.newValue")}</p>}
    {shortened ? <button ref={trigger} type="button" aria-expanded={open} aria-controls={id}
      aria-label={t("activity.fullValue")}
      onClick={() => { pinned.current = !pinned.current; setOpen(pinned.current); }}
      className="group flex w-full items-center gap-3 rounded text-left focus-visible:outline-2 focus-visible:outline-accent">
      <strong ref={text} className="min-w-0 flex-1 truncate">{excerpt}</strong>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors group-hover:bg-accent-soft group-hover:text-accent"><Maximize2 size={14} aria-hidden="true" /></span>
    </button> : <div className="flex min-w-0 items-center gap-3">{imageUrl && <ImageThumbnail url={imageUrl} alt={displayValue} />}<strong ref={text} className="min-w-0 flex-1 truncate">{excerpt || t("Remover este trecho (sem substituição)")}</strong></div>}
    {open && shortened && <div className="absolute left-0 top-full z-30 w-96 max-w-[calc(100vw-4rem)] pt-2">
      <div id={id} role="region" aria-label={t("activity.fullValue")} className="overflow-hidden rounded-xl border bg-white text-sm font-normal shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-xs font-medium text-muted">{t("activity.newValue")}</span>
          <button type="button" aria-label={t("Fechar")} onClick={() => { close(); trigger.current?.focus(); }}
            className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent"><X size={15} aria-hidden="true" /></button>
        </div>
        <div tabIndex={0} className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap p-4 font-semibold leading-relaxed [overflow-wrap:anywhere]">{imageUrl && <div className="mb-3"><ImageThumbnail url={imageUrl} alt={displayValue} expanded /></div>}{displayValue}</div>
      </div>
    </div>}
  </div>;
}
