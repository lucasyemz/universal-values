import type { ReactNode } from "react";

export function GroupActions({ children }: { children: ReactNode }) {
  return <div className="scan-group-direct-actions">{children}</div>;
}
