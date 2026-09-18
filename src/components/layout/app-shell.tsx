"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Globe2, History, LayoutGrid, Layers3, Menu, ScanLine, ShieldCheck, X } from "lucide-react";
import { logout } from "@/modules/auth/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Brand } from "./brand";

type Context = { title: string; siteId?: string; workspaceId?: string; pathname: string };
const PageContext = createContext<(value: Context | null) => void>(() => {});
export function SiteContext({ title, siteId, workspaceId }: Omit<Context, "pathname">) {
  const set = useContext(PageContext);
  const pathname = usePathname();
  useEffect(() => { set({ title, siteId, workspaceId, pathname }); return () => set(null); }, [set, title, siteId, workspaceId, pathname]);
  return null;
}
export function AppShell({ children, workspaces, email, workspaceError }: { children: ReactNode; workspaces: { id: string; name: string }[]; email?: string; workspaceError?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const current = context?.pathname === pathname ? context : null;
  const routeWorkspace = pathname.match(/\/workspaces\/([^/]+)\/sites/)?.[1];
  const workspaceId = routeWorkspace ?? current?.workspaceId ?? (workspaces.length === 1 ? workspaces[0]?.id : undefined);
  const siteId = current?.siteId;
  const siteBase = siteId ? "/dashboard/sites/" + siteId : null;
  const close = () => dialog.current?.close();
  const sidebar = <>
    <Link href="/dashboard" onClick={close} className="mb-8 inline-flex"><Brand /></Link>
    <label className="mb-6 block text-[11px] font-semibold uppercase tracking-wider text-faint">Workspace
      <select aria-label="Selecionar workspace" value={workspaceId ?? ""} className="mt-2 w-full normal-case tracking-normal" onChange={(event) => { close(); router.push(event.target.value ? "/dashboard/workspaces/" + event.target.value + "/sites" : "/dashboard"); }}>
        <option value="">{workspaceError ? "Workspaces indisponíveis" : "Todos os workspaces"}</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </label>
    <nav aria-label="Navegação principal" className="space-y-1">
      <Link onClick={close} href="/dashboard" className="ui-nav-link" aria-current={pathname === "/dashboard" ? "page" : undefined}><LayoutGrid size={17} aria-hidden="true" />Visão geral</Link>
      {workspaceId && <Link onClick={close} href={"/dashboard/workspaces/" + workspaceId + "/sites"} className="ui-nav-link" aria-current={!!routeWorkspace ? "page" : undefined}><Globe2 size={17} aria-hidden="true" />Sites</Link>}
      {siteBase && <><p className="px-3 pb-1 pt-6 text-[11px] font-semibold uppercase tracking-wider text-faint">Neste site</p>
        <Link onClick={close} href={siteBase} className="ui-nav-link" aria-current={pathname === siteBase ? "page" : undefined}><Globe2 size={17} aria-hidden="true" />Explorar CMS</Link>
        <Link onClick={close} href={siteBase + "/facts"} className="ui-nav-link" aria-current={pathname.startsWith(siteBase + "/facts") ? "page" : undefined}><BookOpen size={17} aria-hidden="true" />Global Facts</Link>
        <Link onClick={close} href={siteBase + "/static"} className="ui-nav-link" aria-current={pathname === siteBase + "/static" ? "page" : undefined}><LayoutGrid size={17} aria-hidden="true" />Páginas estáticas</Link>
        <Link onClick={close} href={siteBase + "/scans#recent-scans"} className="ui-nav-link" aria-current={pathname.startsWith("/dashboard/scans/") || pathname === siteBase + "/scans" ? "page" : undefined}><ScanLine size={17} aria-hidden="true" />Scans</Link>
        <Link onClick={close} href={siteBase + "/scans#managed-values"} className="ui-nav-link" aria-current={pathname.includes("/managed-values/") ? "page" : undefined}><Layers3 size={17} aria-hidden="true" />Managed Values</Link>
        <Link onClick={close} href={siteBase + "/scans#changes"} className="ui-nav-link" aria-current={pathname.includes("/changes/") ? "page" : undefined}><History size={17} aria-hidden="true" />Alterações</Link>
      </>}
    </nav>
    <div className="mt-auto pt-8">
      <details className="mb-5 rounded-lg bg-subtle p-3 text-xs text-muted"><summary className="font-medium"><BookOpen size={14} className="mr-2 inline" aria-hidden="true" />Como funciona</summary><p className="mt-3 leading-6">Conecte um site, prepare um scan e revise as ocorrências. Toda alteração no CMS exige sua confirmação. O site não é publicado automaticamente.</p></details>
      <details className="border-t pt-4"><summary className="cursor-pointer truncate text-xs text-muted">{email ?? "Minha conta"}</summary><form action={logout} className="mt-3 space-y-3"><p className="text-xs text-muted">Sair desta sessão neste navegador?</p><SubmitButton variant="secondary" pendingLabel="Saindo…">Confirmar saída</SubmitButton></form></details>
    </div>
  </>;
  return <PageContext.Provider value={setContext}>
    <a className="skip-link" href="#page-content">Pular para o conteúdo</a>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col overflow-y-auto border-r bg-surface p-5 lg:flex">{sidebar}</aside>
    <dialog ref={dialog} className="ui-mobile-dialog" aria-label="Menu de navegação"><button type="button" onClick={close} className="ui-btn ui-btn-ghost mb-4" aria-label="Fechar menu"><X size={18} aria-hidden="true" /></button><div className="flex min-h-[80dvh] flex-col">{sidebar}</div></dialog>
    <div className="min-h-screen lg:pl-60">
      <div className="flex min-h-16 items-center justify-between gap-3 border-b bg-surface px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3"><button type="button" className="ui-btn ui-btn-ghost lg:hidden" aria-label="Abrir menu" onClick={() => dialog.current?.showModal()}><Menu size={19} /></button><Link href="/dashboard" className="shrink-0 text-xs text-muted">Workspace</Link><ChevronRight size={13} className="shrink-0 text-faint" aria-hidden="true" /><span className="truncate text-xs font-medium">{current?.title ?? (routeWorkspace ? workspaces.find((w) => w.id === routeWorkspace)?.name : pathname === "/dashboard" ? "Visão geral" : "Revisão")}</span></div>
        <span className="hidden items-center gap-2 text-xs text-muted sm:flex"><ShieldCheck size={15} className="text-accent" aria-hidden="true" />Alterações sob seu controle</span>
      </div>
      <div id="page-content" tabIndex={-1}>{children}</div>
    </div>
  </PageContext.Provider>;
}
