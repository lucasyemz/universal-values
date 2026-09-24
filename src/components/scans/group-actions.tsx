"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { useText } from "@/i18n/use-text";

export function GroupActions({ children }: { children: ReactNode }) {
  const t = useText();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const shell = root.current?.closest(".scan-group-shell");
    const summary = shell?.querySelector("summary");
    if (!shell || !summary) return;
    const align = () => {
      const heading = summary.getBoundingClientRect();
      if (root.current) root.current.style.top = (heading.top - shell.getBoundingClientRect().top + heading.height / 2) + "px";
    };
    const observer = new ResizeObserver(align);
    observer.observe(summary);
    align();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return <div ref={root} className={"scan-group-actions " + (open ? "is-open" : "")}>
    <button ref={trigger} type="button" className="ui-btn" aria-label={t("Ações do grupo")} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <MoreHorizontal size={18} aria-hidden="true"/><span>{t("Ações do grupo")}</span>
    </button>
    {open && <div id={id} role="region" aria-label={t("Ações do grupo")} className="scan-group-actions-panel">{children}</div>}
  </div>;
}
