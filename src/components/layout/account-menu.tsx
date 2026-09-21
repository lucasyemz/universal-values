"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, Globe2, LogOut, ShieldCheck } from "lucide-react";
import { logout } from "@/modules/auth/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export function AccountMenu({ email, plan, workspaceId, onNavigate }: {
  email?: string; plan: "free" | "admin"; workspaceId?: string; onNavigate: () => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const pathname = usePathname();
  const name = email?.split("@")[0] || "Minha conta";
  const planLabel = plan === "admin" ? "Administrador" : "Free";
  const settings = workspaceId ? `/dashboard/workspaces/${workspaceId}/settings/webflow` : "/dashboard/settings/webflow";
  const close = () => panel.current?.hidePopover();
  const navigate = () => { close(); onNavigate(); };

  useEffect(() => { panel.current?.hidePopover(); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    // Avoid leaving a floating panel detached from its account button.
    const hide = () => panel.current?.hidePopover();
    const scroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      hide();
    };
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", scroll, true);
    return () => { window.removeEventListener("resize", hide); window.removeEventListener("scroll", scroll, true); };
  }, [open]);

  const place = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(288, window.innerWidth - 24);
    const above = rect.top >= window.innerHeight - rect.bottom;
    setPosition({ position: "fixed", margin: 0, width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: above ? "auto" : rect.bottom + 8, bottom: above ? window.innerHeight - rect.top + 8 : "auto",
      maxHeight: Math.max(80, (above ? rect.top : window.innerHeight - rect.bottom) - 20) });
  };

  return <div className="border-t pt-3">
    <button ref={trigger} type="button" popoverTarget={id} onClick={place} aria-expanded={open} aria-controls={id} aria-haspopup="dialog"
      className="flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent" title={email ?? "Minha conta"}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent" aria-hidden="true">{name.slice(0, 2)}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{name}</span><span className="block text-xs text-muted">{planLabel}</span></span>
      <ChevronsUpDown size={16} className="shrink-0 text-muted" aria-hidden="true" />
    </button>
    <div id={id} ref={panel} popover="auto" role="dialog" aria-label="Opções da conta" style={position}
      onToggle={event => { setOpen(event.newState === "open"); if (event.newState === "closed") panel.current?.querySelectorAll("details[open]").forEach(detail => detail.removeAttribute("open")); }}
      className="overflow-y-auto rounded-2xl border bg-surface p-2 text-ink shadow-xl">
      <div className="border-b px-3 py-3"><p title={email ?? name} className="truncate text-sm font-semibold">{email ?? name}</p><p className="mt-1 text-xs text-muted">{planLabel}</p></div>
      <nav aria-label="Configurações da conta" className="space-y-1 py-2">
        <Link onClick={navigate} href={settings} className="ui-nav-link" aria-current={pathname.endsWith("/settings/webflow") ? "page" : undefined}><Globe2 size={18} className="shrink-0" aria-hidden="true" />Configurações do Webflow</Link>
        <Link onClick={navigate} href="/dashboard/plan" className="ui-nav-link" aria-current={pathname === "/dashboard/plan" ? "page" : undefined}><ShieldCheck size={18} className="shrink-0" aria-hidden="true" /><span>Plano e consumo<span className="block text-xs text-muted">Ver limites e trocar de plano</span></span></Link>
      </nav>
      <details className="border-t pt-2"><summary className="ui-nav-link cursor-pointer list-none [&::-webkit-details-marker]:hidden"><LogOut size={18} className="shrink-0" aria-hidden="true" />Sair</summary><form action={logout} className="space-y-3 px-3 pb-3 pt-2"><p className="text-xs text-muted">Sair desta sessão neste navegador?</p><SubmitButton variant="secondary" pendingLabel="Saindo…">Confirmar saída</SubmitButton></form></details>
    </div>
  </div>;
}
