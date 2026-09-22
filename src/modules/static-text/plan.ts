import { linkReviewSchema, validLinkEdit } from "./link-edit";
import { findTextMatches, searchOptionsSchema, type SearchOptions } from "../text-search/match";
import { z } from "zod";

const instanceSourceSchema = z.object({ kind: z.literal("component-prop"), componentName: z.string(), propName: z.string(), instanceId: z.string(), componentId: z.string(), propId: z.string() });
export const componentSourceSchema = z.discriminatedUnion("kind", [instanceSourceSchema, z.object({
  kind: z.literal("component-definition"), componentName: z.string(), componentId: z.string(),
  instanceCount: z.number().int().nonnegative(),
})]);

export const nodeSchema = z.object({ id: z.string().min(1), text: z.string().max(10000), source: componentSourceSchema.optional() });
export const contextSchema = z.object({ siteId: z.string().min(1), pageId: z.string().min(1), pageName: z.string(), rootId: z.string().min(1) });
export type TextNode = z.infer<typeof nodeSchema>;
export type PageContext = z.infer<typeof contextSchema>;
export const searchSchema = z.string().min(1).max(200).refine(value => value.trim().length > 0, "Informe um texto para buscar.");
export const changeSchema = z.object({ id: z.string(), before: z.string().max(10000), after: z.string().max(10000), source: componentSourceSchema.optional(), link: linkReviewSchema.optional() }).refine(change => !change.link || validLinkEdit(change.before, change.after, change.link.afterUrl, change.link.convertsPage), "Prévia de link inválida.");
export const planSchema = z.object({
  id: z.uuid(), context: contextSchema, expiresAt: z.number(), searchOptions: searchOptionsSchema.optional(),
  changes: z.array(changeSchema).min(1).max(100),
}).refine(plan => plan.changes.every(change => Boolean(change.link) === Boolean(plan.changes[0]?.link)), "Prévia com tipos misturados.").refine(plan => new Set(plan.changes.map(change => change.id)).size === plan.changes.length);
export type TextPlan = z.infer<typeof planSchema>;
export type Mention = { key: string; nodeId: string; start: number; end: number; before: string; text: string; after: string; source?: TextNode["source"] };

export function findMentions(nodes: TextNode[], input: string, options?: SearchOptions): Mention[] {
  const search = searchSchema.parse(input);
  const result: Mention[] = [];
  for (const node of nodes) {
    for (const { start, end, raw } of findTextMatches(node.text, search, options)) {
      result.push({ key: JSON.stringify([node.id, start]), nodeId: node.id, start, end, ...(node.source ? {source:node.source} : {}),
        before: node.text.slice(Math.max(0, start - 90), start), text: raw, after: node.text.slice(end, end + 90) });
      if (result.length > 100) throw new Error("Mais de 100 menções. Use um texto mais específico.");
    }
  }
  return result;
}

export function preparePlan(context: PageContext, nodes: TextNode[], search: string, replacements: Record<string, string>, now = Date.now(), options?: SearchOptions): TextPlan {
  const mentions = findMentions(nodes, search, options);
  if (Object.keys(replacements).some(key => !mentions.some(mention => mention.key === key))) throw new Error("Seleção inválida. Faça outra busca.");
  const changes = nodes.flatMap(node => {
    let after = node.text;
    for (const mention of mentions.filter(item => item.nodeId === node.id).reverse()) {
      if (!Object.hasOwn(replacements, mention.key)) continue;
      const replacement = z.string().max(2000).parse(replacements[mention.key]);
      after = after.slice(0, mention.start) + replacement + after.slice(mention.end);
    }
    return after === node.text ? [] : [{ id: node.id, before: node.text, after, ...(node.source ? {source:node.source} : {}) }];
  });
  if (!changes.length) throw new Error("Nenhuma alteração selecionada.");
  return planSchema.parse({ id: crypto.randomUUID(), context, changes, ...(options ? { searchOptions: options } : {}), expiresAt: now + 15 * 60_000 });
}
