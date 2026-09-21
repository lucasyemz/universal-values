// Numeric CMS fields are matched as whole values, never as editable substrings.
// Accept decimal comma or point; do not guess thousands separators or exponents.
export function numericSearchValue(term?: string): string | null {
  const text = term?.trim();
  if (!text || !/^-?(0|[1-9]\d*)([.,]\d+)?$/.test(text)) return null;
  const value = Number(text.replace(",", "."));
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) return null;
  const normalized = String(value);
  // Avoid rounding a query into a different CMS value.
  const exact = text.replace(",", ".").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return normalized === exact || value === 0 && /^-?0(?:\.0*)?$/.test(exact) ? normalized : null;
}
