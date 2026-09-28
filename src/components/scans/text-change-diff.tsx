import { Diff } from "@/components/ui";
import { textDiff, type TextPart } from "@/modules/scans/text-diff";

function Text({ parts, tone }: { parts: TextPart[]; tone?: "before" | "after" }) {
  return <>{parts.map((part, index) => part.changed ? <strong key={index} className={tone ? "rounded px-0.5 font-semibold " + (tone === "before" ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950") : "font-bold"}>{part.text}</strong> : part.text)}</>;
}
export function TextChangeDiff({ before, after, highlight, beforeLabel, afterLabel, marked = false }: { before: string; after: string; highlight: boolean; beforeLabel?: string; afterLabel?: string; marked?: boolean }) {
  const parts = highlight ? textDiff(before, after) : null;
  return <Diff beforeLabel={beforeLabel} afterLabel={afterLabel} before={parts ? <Text parts={parts.before} tone={marked ? "before" : undefined}/> : before} after={parts ? <Text parts={parts.after} tone={marked ? "after" : undefined}/> : after}/>;
}
