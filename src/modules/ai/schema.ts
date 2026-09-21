import { z } from "zod";
export const aiKeySchema = z.string().trim().regex(/^[A-Za-z0-9_.=-]{30,8192}$/, "Confira a chave do Google AI Studio.");
import { isPlaceholder } from "@/modules/text-search/placeholders";
export { isPlaceholder };
export const suggestionInputSchema = z.strictObject({
  collection: z.string().max(255), item: z.string().max(255), field: z.string().max(255),
  original: z.string().min(1).max(2000), surrounding: z.string().max(2400),
  facts: z.string().trim().min(12, "Informe pelo menos uma informação real sobre o item.").max(4000)
    .refine(value => !isPlaceholder(value), "Substitua o texto de exemplo por informações reais do item."),
  siteLanguage: z.string().max(100).optional(),
  language: z.enum(["auto", "pt-BR", "en", "es"]),
});
export type SuggestionInput = z.infer<typeof suggestionInputSchema>;
export const suggestionSchema = z.strictObject({ text: z.string().trim().max(2000), needsContext: z.boolean() });
export type Suggestion = z.infer<typeof suggestionSchema>;
export type AiContext = { collection: string; item: string; field: string; original: string; surrounding: string; facts: string; siteLanguage?: string };
