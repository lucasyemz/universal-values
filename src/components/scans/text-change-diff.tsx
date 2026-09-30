import { TextParts } from "@/components/ui/text-parts";
import { Diff } from "@/components/ui";
import { recordedTextParts, textDiff } from "@/modules/scans/text-diff";

export function TextChangeDiff({ before, after, highlight, beforeLabel, afterLabel, marked = false, recordedRanges }: { before: string; after: string; highlight: boolean; beforeLabel?: string; afterLabel?: string; marked?: boolean; recordedRanges?: readonly { start: number; end: number; raw: string }[] }) {
  const parts = highlight ? before === after && recordedRanges?.length ? { before: recordedTextParts(before, recordedRanges), after: recordedTextParts(after, recordedRanges) } : textDiff(before, after) : null;
  return <Diff beforeLabel={beforeLabel} afterLabel={afterLabel} before={parts ? <TextParts parts={parts.before} tone={marked ? "before" : undefined}/> : before} after={parts ? <TextParts parts={parts.after} tone={marked ? "after" : undefined}/> : after}/>;
}
