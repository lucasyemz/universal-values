export type TextPart = { text: string; changed: boolean };

/** Display-only word diff. Never use these segments as a provider payload. */
export function textDiff(before: string, after: string): { before: TextPart[]; after: TextPart[] } {
  if (before === after) {
    const parts = before ? [{ text: before, changed: false }] : [];
    return { before: parts, after: parts };
  }
  const tokens = (text: string) => text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
  const a = tokens(before), b = tokens(after);
  const left = a.map(text => ({ text, changed: true })), right = b.map(text => ({ text, changed: true }));
  let start = 0, endA = a.length, endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) { left[start]!.changed = right[start]!.changed = false; start++; }
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { left[--endA]!.changed = right[--endB]!.changed = false; }
  const n = endA - start, m = endB - start;
  // Bound memory/work for unusually large rich-text fields.
  if (n * m <= 250_000 && n && m) {
    const matrix = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) matrix[i]![j] = a[start+i] === b[start+j] ? 1 + matrix[i+1]![j+1]! : Math.max(matrix[i+1]![j]!, matrix[i]![j+1]!);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[start+i] === b[start+j]) { left[start+i]!.changed = right[start+j]!.changed = false; i++; j++; }
      else if (matrix[i+1]![j]! >= matrix[i]![j+1]!) i++; else j++;
    }
  }
  const compact = (parts: TextPart[]) => {
    const result: TextPart[] = [];
    for (const part of parts) {
      const last = result.at(-1);
      if (last?.changed === part.changed) last.text += part.text;
      else result.push({ ...part });
    }
    return result;
  };
  return { before: compact(left), after: compact(right) };
}

/** Highlight exact recorded ranges even when a verified value was already present. */
export function recordedTextParts(text: string, ranges: readonly { start: number; end: number; raw: string }[]): TextPart[] {
  const chars = [...text];
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < cursor || range.end <= range.start || range.end > chars.length || chars.slice(range.start, range.end).join("") !== range.raw) return [{ text, changed: false }];
    if (range.start > cursor) parts.push({ text: chars.slice(cursor, range.start).join(""), changed: false });
    parts.push({ text: range.raw, changed: true });
    cursor = range.end;
  }
  if (cursor < chars.length) parts.push({ text: chars.slice(cursor).join(""), changed: false });
  return parts;
}
