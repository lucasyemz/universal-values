// Explicit placeholder phrases only: arbitrary prose is never classified by AI.
export const isPlaceholder = (value: string) => /\blorem\s+ipsum\b|\bdolor\s+sit\s+amet\b|\bconsectetur\s+adipiscing\b|\b(?:sample|placeholder|dummy)\s+text\b|\btexto\s+(?:de\s+exemplo|de\s+teste|fictício)\b/iu.test(value);
