"use client";
import { useEffect } from "react";
import { legacySiteDestination } from "@/modules/sites/legacy-section";
import { useRouter } from "next/navigation";
// Preserve bookmarks from the former single-page site dashboard.
export function LegacySiteSection({ siteId, section = "scans", fallback }: { siteId: string; section?: "scans" | "static"; fallback?: string }) {
  const router = useRouter();
  useEffect(() => {
    const restore = () => { const destination = legacySiteDestination(siteId,window.location.hash,section) ?? fallback; if (destination) router.replace(destination); };
    restore(); window.addEventListener("hashchange",restore); return () => window.removeEventListener("hashchange",restore);
  }, [siteId,router,section,fallback]);
  return null;
}
