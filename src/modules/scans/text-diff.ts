export type TextPart = { text: string; changed: boolean };

/** Display-only word diff. Never use these segments as a provider payload. */
export function textDiff(before: string, after: string): { before: TextPart[]; after: TextPart[] } {
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
  return { before: left, after: right };
}
