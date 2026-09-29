"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const eventName = "replaceall:sidebar-preference";
const fallback = new Map<string, boolean>();
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(eventName, listener);
  };
}

export function SidebarDisclosure({ preferenceKey, navigation, expandLabel, collapseLabel, children }: {
  preferenceKey: string;
  navigation: ReactNode;
  expandLabel: string;
  collapseLabel: string;
  children: ReactNode;
}) {
  const id = useId();
  const key = `replaceall:sidebar:v1:${preferenceKey}`;
  const open = useSyncExternalStore(subscribe, () => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "closed" || saved === "open") return saved === "open";
    } catch { /* Browser storage is optional. */ }
    return fallback.get(key) ?? true;
  }, () => true);
  function toggle() {
    fallback.set(key, !open);
    try { localStorage.setItem(key, open ? "closed" : "open"); } catch { /* Keep the in-memory preference. */ }
    window.dispatchEvent(new Event(eventName));
  }
  return <div>
    <div className="flex items-center gap-1">
      {navigation}
      <button type="button" className="ui-btn ui-btn-ghost shrink-0 !px-2" aria-expanded={open} aria-controls={id} aria-label={open ? collapseLabel : expandLabel} onClick={toggle}>
        <ChevronDown size={16} className={open ? undefined : "-rotate-90"} aria-hidden="true" />
      </button>
    </div>
    <div id={id} hidden={!open}>{children}</div>
  </div>;
}
