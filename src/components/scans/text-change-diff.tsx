import { Diff } from "@/components/ui";
import { textDiff, type TextPart } from "@/modules/scans/text-diff";

function Text({ parts }: { parts: TextPart[] }) {
  return <>{parts.map((part, index) => part.changed ? <strong key={index} className="font-bold">{part.text}</strong> : part.text)}</>;
}
export function TextChangeDiff({ before, after, highlight, beforeLabel, afterLabel }: { before: string; after: string; highlight: boolean; beforeLabel?: string; afterLabel?: string }) {
  const parts = highlight ? textDiff(before, after) : null;
  return <Diff beforeLabel={beforeLabel} afterLabel={afterLabel} before={parts ? <Text parts={parts.before}/> : before} after={parts ? <Text parts={parts.after}/> : after}/>;
}
