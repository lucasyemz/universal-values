"use client";
import { createContext, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { readNavigation, stateHref, stateKey } from "@/modules/navigation/state";
const User = createContext("");
export function NavigationState({ userId, children }: { userId: string; children: ReactNode }) {
  const pathname = usePathname(), params = useSearchParams();
  const href = stateHref(pathname + "?" + params.toString());
  useEffect(() => {
    if (!href) return;
    const root = document.getElementById("page-content");
    if (!root) return;
    const details = () => [...root.querySelectorAll<HTMLDetailsElement>("details[data-state-key][data-state-ready]")];
    const selections = () => [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-selection-key][data-state-ready]:not(:disabled)')];
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
      try { const previous = readNavigation(sessionStorage, userId, pathname); const sameView = previous?.href === href ? previous : undefined; sessionStorage.setItem(stateKey(userId, pathname), JSON.stringify({ href, y: window.scrollY, details: { ...sameView?.details, ...Object.fromEntries(details().map(element => [element.dataset.stateKey!, element.open])) }, selections: { ...sameView?.selections, ...Object.fromEntries(selections().map(element => [element.dataset.selectionKey!, element.checked])) }, savedAt: Date.now() })); } catch { /* Best effort only. */ }
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
  const router = useRouter();
  const userId = useContext(User);
  return <Link {...props} href={href} prefetch={false} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === "_blank") return;
    // An explicit query is authoritative, especially Needs Attention / Quick Search links.
    if (!userId || href.includes("?") || href.includes("#") || !stateHref(href)) return;
    try {
      const saved = readNavigation(sessionStorage, userId, href);
      event.preventDefault(); router.push(saved?.href ?? href);
    } catch { /* Fall back to the ordinary link. */ }
  }} />;
}

// Restore each control only after its own hydration, not when streamed HTML is
// inserted into the layout. Its first client render must match the server.
export function RememberedDetails({ stateId, initiallyOpen = false, ...props }: Omit<ComponentProps<"details">, "open"> & { stateId: string; initiallyOpen?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null), userId = useContext(User);
  const pathname = usePathname(), params = useSearchParams();
  const href = stateHref(pathname + "?" + params.toString());
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    try {
      const saved = readNavigation(sessionStorage, userId, pathname);
      element.open = saved?.href === href ? saved.details[stateId] ?? initiallyOpen : initiallyOpen;
    } catch { /* Keep the deterministic server default. */ }
    element.dataset.stateReady = "true";
  }, [userId, pathname, href, stateId, initiallyOpen]);
  return <details {...props} ref={ref} open={initiallyOpen} data-state-key={stateId}/>;
}

export function RememberedCheckbox({ selectionId, ...props }: Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked"> & { selectionId: string }) {
  const ref = useRef<HTMLInputElement>(null), userId = useContext(User);
  const pathname = usePathname(), params = useSearchParams();
  const href = stateHref(pathname + "?" + params.toString());
  useEffect(() => {
    const element = ref.current;
    if (!element || props.disabled) return;
    try {
      const saved = readNavigation(sessionStorage, userId, pathname);
      element.checked = saved?.href === href ? saved.selections[selectionId] ?? false : false;
    } catch { /* Browser selection remains usable without storage. */ }
    element.dataset.stateReady = "true";
  }, [userId, pathname, href, selectionId, props.disabled]);
  return <input {...props} ref={ref} type="checkbox" defaultChecked={false} data-selection-key={selectionId}/>;
}
