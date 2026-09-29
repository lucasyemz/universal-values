"use client";

import { SidebarDisclosure } from "./sidebar-disclosure";
import Link from "next/link";
import { Globe2 } from "lucide-react";
import { useText } from "@/i18n/use-text";

export type NavigationWorkspace = {
  id: string;
  name: string;
  href: string;
  sites: { id: string; name: string; href: string }[] | null;
};

export function SiteSwitcher({ workspace, pathname, onNavigate, userId }: {
  userId: string;
  workspace: NavigationWorkspace;
  pathname: string;
  onNavigate: () => void;
}) {
  const t = useText();
  return <SidebarDisclosure preferenceKey={userId+":sites"} expandLabel={t("Expandir sites")} collapseLabel={t("Recolher sites")} navigation={
      <Link prefetch={false} href={workspace.href} onClick={onNavigate} className="ui-nav-link min-w-0 flex-1" aria-current={pathname === workspace.href ? "page" : undefined}>
        <Globe2 size={17} aria-hidden="true" />{t("Sites")}
      </Link>
    }>
    <ul aria-label={t("Sites do workspace")} className="ml-5 mt-1 max-h-60 space-y-1 overflow-y-auto border-l pl-2">
      {workspace.sites?.map(site => {
        const base = site.href.replace(/\/overview$/, "");
        const active = pathname === base || pathname.startsWith(base + "/");
        return <li key={site.id}><Link prefetch={false} href={site.href} onClick={onNavigate} title={site.name} className="ui-nav-link !py-2 !text-xs" aria-current={active ? "location" : undefined}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-accent" : "bg-current opacity-40"}`} /><span className="truncate">{site.name}</span>
        </Link></li>;
      })}
      {!workspace.sites?.length && <li className="px-3 py-2 text-xs text-muted">{t(workspace.sites === null ? "Lista de sites indisponível." : "Nenhum site neste workspace.")}</li>}
    </ul>
  </SidebarDisclosure>;
}
