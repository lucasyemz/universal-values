"use client";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <LoaderCircle size={14} className="ml-2 animate-spin" aria-hidden="true" /> : null;
}
/** Client navigation and immediate feedback without speculative provider reads. */
export function TabLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} scroll={false}>{children}<Pending /></Link>;
}
