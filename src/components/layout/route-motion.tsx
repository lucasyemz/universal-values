"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Animate navigation without remounting children or touching editing/query state. */
export function RouteMotion({ children }: { children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const target = element.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!target?.animate || preference.matches) return;
    // Opacity only: no transformed ancestor for fixed panels or sticky controls.
    const animation = target.animate([{ opacity: .65 }, { opacity: 1 }], {
      duration: 220, easing: "cubic-bezier(.22, 1, .36, 1)",
    });
    const cancel = () => animation.cancel();
    preference.addEventListener("change", cancel);
    return () => { cancel(); preference.removeEventListener("change", cancel); };
  }, [pathname]);
  return <div id="page-content" ref={element} tabIndex={-1}>{children}</div>;
}
