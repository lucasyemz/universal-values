import { isPlaceholder, suggestionInputSchema, type AiContext } from "./schema";

// Current editor text is the basis for a rewrite; placeholders are never facts.
export function directSuggestionInput(context: AiContext, currentValue: string) {
  const original = currentValue.trim() || context.original;
  const existingFacts = isPlaceholder(original) ? "" : `Texto atual: ${original}`;
  return suggestionInputSchema.parse({
    ...context,
    original,
    facts: [existingFacts, context.facts].filter(Boolean).join("\n").slice(0, 4000),
    language: "auto",
  });
}
