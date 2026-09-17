import { z } from "zod";

export const nodeSchema = z.object({ id: z.string().min(1), text: z.string().max(10000) });
export const contextSchema = z.object({ siteId: z.string().min(1), pageId: z.string().min(1), pageName: z.string(), rootId: z.string().min(1) });
export type TextNode = z.infer<typeof nodeSchema>;
export type PageContext = z.infer<typeof contextSchema>;
export const searchSchema = z.string().min(1).max(200).refine(value => value.trim().length > 0, "Informe um texto para buscar.");
export const changeSchema = z.object({ id: z.string(), before: z.string().max(10000), after: z.string().max(10000) });
export const planSchema = z.object({
  id: z.uuid(), context: contextSchema, expiresAt: z.number(),
  changes: z.array(changeSchema).min(1).max(100),
}).refine(plan => new Set(plan.changes.map(change => change.id)).size === plan.changes.length);
export type TextPlan = z.infer<typeof planSchema>;
export type Mention = { key: string; nodeId: string; start: number; end: number; before: string; text: string; after: string };

export function findMentions(nodes: TextNode[], input: string): Mention[] {
  const search = searchSchema.parse(input);
  const result: Mention[] = [];
  for (const node of nodes) {
    let offset = 0;
    while (offset <= node.text.length) {
      const start = node.text.indexOf(search, offset);
      if (start < 0) break;
      const end = start + search.length;
      result.push({ key: JSON.stringify([node.id, start]), nodeId: node.id, start, end,
        before: node.text.slice(Math.max(0, start - 90), start), text: search, after: node.text.slice(end, end + 90) });
      if (result.length > 100) throw new Error("Mais de 100 menções. Use um texto mais específico.");
      offset = end;
    }
  }
  return result;
}

export function preparePlan(context: PageContext, nodes: TextNode[], search: string, replacements: Record<string, string>, now = Date.now()): TextPlan {
  const mentions = findMentions(nodes, search);
  if (Object.keys(replacements).some(key => !mentions.some(mention => mention.key === key))) throw new Error("Seleção inválida. Faça outra busca.");
  const changes = nodes.flatMap(node => {
    let after = node.text;
    for (const mention of mentions.filter(item => item.nodeId === node.id).reverse()) {
      if (!Object.hasOwn(replacements, mention.key)) continue;
      const replacement = z.string().max(2000).parse(replacements[mention.key]);
      after = after.slice(0, mention.start) + replacement + after.slice(mention.end);
    }
    return after === node.text ? [] : [{ id: node.id, before: node.text, after }];
  });
  if (!changes.length) throw new Error("Nenhuma alteração selecionada.");
  return planSchema.parse({ id: crypto.randomUUID(), context, changes, expiresAt: now + 15 * 60_000 });
}
