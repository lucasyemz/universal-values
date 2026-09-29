import type { TextPart } from "@/modules/scans/text-diff";

/** Compact display segments only; never used to construct a write payload. */
export function TextParts({ parts, tone }: { parts: TextPart[]; tone?: "before" | "after" }) {
  const highlight = tone === "before"
    ? "bg-[var(--match-before-bg)] text-[var(--match-before-text)]"
    : "bg-[var(--match-after-bg)] text-[var(--match-after-text)]";
  return <>{parts.map((part, index) => part.changed
    ? <strong key={index} className={tone ? `rounded px-0.5 font-semibold ${highlight}` : "font-bold"}>{part.text}</strong>
    : part.text)}</>;
}
