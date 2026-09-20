import type { ComponentProps } from "react";

// Native navigation requests fresh server data instead of restoring Next's client route cache.
// It remains a link: keyboard navigation, new tabs and copying the URL still work.
export function FreshLink({ className = "", ...props }: ComponentProps<"a"> & { href: string }) {
  return <a {...props} className={`ui-btn ${className}`} />;
}
