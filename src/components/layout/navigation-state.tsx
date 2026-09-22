"use client";
import { createContext, useContext, useEffect, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { readNavigation, stateHref, stateKey } from "@/modules/navigation/state";
const User = createContext("");
export function NavigationState({ userId, children }: { userId: string; children: ReactNode }) {
  const pathname = usePathname(), params = useSearchParams();
  const href = stateHref(pathname + "?" + params.toString());
  useEffect(() => {
    if (!href) return;
    const root = document.getElementById("page-content");
    if (!root) return;
    const details = () => [...root.querySelectorAll<HTMLDetailsElement>("details[data-state-key]")];
    const selections = () => [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-selection-key]:not(:disabled)')];
    let restoring = true;
    let restored = false;
    let frame = 0;
    const restore = () => {
      // Route content can stream after the layout effect. Wait for the actual view.
      if (restored || !root.querySelector("main.ui-page")) return;
      restored = true;
      try {
        const state = readNavigation(sessionStorage, userId, pathname);
        if (state?.href === href) {
          for (const element of details()) { const open = state.details[element.dataset.stateKey!]; if (open !== undefined) element.open = open; }
          for (const element of selections()) { const checked = state.selections[element.dataset.selectionKey!]; if (checked !== undefined) element.checked = checked; }
          if (!window.location.hash) window.scrollTo({ top: state.y, behavior: "instant" });
        }
      } catch { /* Storage unavailable: normal navigation still works. */ }
      frame = requestAnimationFrame(() => { restoring = false; });
    };
    const observer = new MutationObserver(restore);
    observer.observe(root, { childList: true, subtree: true });
    restore();
    const save = () => {
      if (restoring) return;
      try { sessionStorage.setItem(stateKey(userId, pathname), JSON.stringify({ href, y: window.scrollY, details: Object.fromEntries(details().map(element => [element.dataset.stateKey!, element.open])), selections: Object.fromEntries(selections().map(element => [element.dataset.selectionKey!, element.checked])), savedAt: Date.now() })); } catch { /* Best effort only. */ }
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);
    root.addEventListener("toggle", save, true);
    root.addEventListener("change", save, true);
    document.addEventListener("click", save, true);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("scroll", save); window.removeEventListener("pagehide", save); root.removeEventListener("toggle", save, true); root.removeEventListener("change", save, true); document.removeEventListener("click", save, true); };
  }, [userId, pathname, href]);
  return <User.Provider value={userId}>{children}</User.Provider>;
}
export function RememberedLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const userId = useContext(User);
  return <Link {...props} href={href} prefetch={false} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === "_blank") return;
    // An explicit query is authoritative, especially Needs Attention / Quick Search links.
    if (!userId || href.includes("?") || href.includes("#") || !stateHref(href)) return;
    try {
      const saved = readNavigation(sessionStorage, userId, href);
      event.preventDefault(); window.location.assign(saved?.href ?? href);
    } catch { /* Fall back to the ordinary link. */ }
  }} />;
}
