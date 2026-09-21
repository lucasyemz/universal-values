"use client";

import { useText } from "@/i18n/use-text";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { logout } from "@/modules/auth/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export function AccountMenu({ email, plan, onNavigate }: {
  email?: string; plan: "free" | "admin"; workspaceId?: string; onNavigate: () => void;
}) {
  const t = useText();

  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const pathname = usePathname();
  const name = email?.split("@")[0] || t("Minha conta");
  const planLabel = plan === "admin" ? t("Administrador") : "Free";
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
      className="flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent" title={email ?? t("Minha conta")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent" aria-hidden="true">{name.slice(0, 2)}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{name}</span><span className="block text-xs text-muted">{planLabel}</span></span>
      <ChevronsUpDown size={16} className="shrink-0 text-muted" aria-hidden="true" />
    </button>
    <div id={id} ref={panel} popover="auto" role="dialog" aria-label={t("Opções da conta")} style={position}
      onToggle={event => { setOpen(event.newState === "open"); if (event.newState === "closed") panel.current?.querySelectorAll("details[open]").forEach(detail => detail.removeAttribute("open")); }}
      className="overflow-y-auto rounded-2xl border bg-surface p-2 text-ink shadow-xl">
      <div className="border-b px-3 py-3"><p title={email ?? name} className="truncate text-sm font-semibold">{email ?? name}</p><p className="mt-1 text-xs text-muted">{planLabel}</p></div>
      <nav aria-label={t("Configurações da conta")} className="space-y-1 py-2">
        <Link onClick={navigate} href="/dashboard/plan" className="ui-nav-link" aria-current={pathname === "/dashboard/plan" ? "page" : undefined}><ShieldCheck size={18} className="shrink-0" aria-hidden="true" /><span>{t("Plano e consumo")}<span className="block text-xs text-muted">{t("Ver limites e trocar de plano")}</span></span></Link>
        <Link onClick={navigate} href="/dashboard/settings/integrations" className="ui-nav-link" aria-current={pathname === "/dashboard/settings/integrations" ? "page" : undefined}><Sparkles size={18} className="shrink-0" aria-hidden="true" />{t("Integrações")}</Link>
        <LanguageSwitcher />
      </nav>
      <details className="border-t pt-2"><summary className="ui-nav-link cursor-pointer list-none [&::-webkit-details-marker]:hidden"><LogOut size={18} className="shrink-0" aria-hidden="true" />{t("Sair")}</summary><form action={logout} className="space-y-3 px-3 pb-3 pt-2"><p className="text-xs text-muted">{t("Sair desta sessão neste navegador?")}</p><SubmitButton variant="secondary" pendingLabel={t("Saindo…")}>{t("Confirmar saída")}</SubmitButton></form></details>
    </div>
  </div>;
}
