import { textDiff } from "@/modules/scans/text-diff";

/** Display only. Provider payloads always come from the validated domain plan. */
export function LiveTextContext({ before, after, label, removalLabel, matches = [] }: { before: string; after: string; label: string; removalLabel: string; matches?: { start: number; end: number }[] }) {
  const diff = textDiff(before, after);
  const unchangedParts = [];
  let cursor = 0;
  for (const match of [...matches].sort((a,b)=>a.start-b.start)) {
    if (match.start < cursor || match.end > after.length || match.end <= match.start) continue;
    unchangedParts.push(after.slice(cursor,match.start), <mark className="match-highlight rounded bg-amber-100 text-slate-900" key={match.start}>{after.slice(match.start,match.end)}</mark>);
    cursor=match.end;
  }
  unchangedParts.push(after.slice(cursor));
  return <div className="live-text-context mt-3 rounded-lg border bg-subtle p-3">
    {label && <p className="text-xs text-muted">{label}</p>}
    <p className="context whitespace-pre-wrap break-words">{before === after ? unchangedParts : diff.after.map((part, index) => part.changed ? <mark className="rounded bg-green-100 text-green-900" key={index}>{part.text}</mark> : part.text)}</p>
    {diff.before.some(part => part.changed) && after.length < before.length && <small>{removalLabel}</small>}
  </div>;
}
