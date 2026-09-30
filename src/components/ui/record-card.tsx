import type { ReactNode } from "react";

/** Shared presentation for resource summaries; callers own data and actions. */
export function RecordCard({ children, compact = false, as: Tag = "li" }: { children: ReactNode; compact?: boolean; as?: "li" | "article" }) {
  return <Tag className={"record-card" + (compact ? " record-card-compact" : "")}>{children}</Tag>;
}
export function RecordHeading({ icon, title, subtitle, status }: { icon: ReactNode; title: ReactNode; subtitle: ReactNode; status: ReactNode }) {
  return <div className="record-heading"><div className="record-identity"><span className="record-icon">{icon}</span><div className="min-w-0 flex-1"><h3 className="record-title">{title}</h3><p className="record-subtitle">{subtitle}</p></div></div>{status}</div>;
}
export function RecordMetadata({ children, accessory }: { children: ReactNode; accessory?: ReactNode }) {
  return <div className="record-metadata"><div className="record-scope">{children}</div>{accessory}</div>;
}
export function RecordFooter({ children, actions }: { children?: ReactNode; actions: ReactNode }) {
  return <div className="record-footer">{children}<div className="record-actions">{actions}</div></div>;
}
