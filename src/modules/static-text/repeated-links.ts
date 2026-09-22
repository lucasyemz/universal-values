import {planSchema, type PageContext, type TextNode} from "./plan";
import {replaceLinkSnapshot,linkSnapshotSchema} from "./link-edit";
import { z } from "zod";

const destinationSchema = z.discriminatedUnion("mode", [
  z.object({mode: z.literal("url"), to: z.string()}),
  z.object({mode: z.literal("page"), to: z.object({pageId: z.string().min(1)})}),
  z.object({mode: z.literal("pageSection"), to: z.object({fullElementId: z.object({component: z.string(), element: z.string()})})}),
  z.object({mode: z.literal("email"), to: z.string(), emailSubject: z.string().optional()}),
  z.object({mode: z.literal("phone"), to: z.string()}),
  z.object({mode: z.literal("file"), to: z.object({assetId: z.string()})}),
]);
export type LinkDestination = z.infer<typeof destinationSchema>;
export function parseLinkDestination(value: unknown): LinkDestination | null {
  const parsed = destinationSchema.safeParse(typeof value === "string" ? {mode: "url", to: value} : value);
  return parsed.success ? parsed.data : null;
}
export type LinkOccurrence = {id: string; label: string; location: string; destination: LinkDestination; text?:string; targetId?:string; snapshot?:string; source?:TextNode["source"]};
export type LinkPage = {name: string; path: string | null};

function urlKey(value: string) {
  const raw = value.trim();
  if (!raw || raw === "#" || /[\u0000-\u001f\\]/.test(raw)) return null;
  try {
    const relative = !/^[a-z][a-z\d+.-]*:/i.test(raw) && !raw.startsWith("//");
    const url = new URL(raw, "https://copyreplace.invalid/");
    if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol) || url.username || url.password) return null;
    // Do not fold path case, discard query strings, or equate different origins.
    return relative ? `relative:${raw}` : `url:${url.href}`;
  } catch { return null; }
}
export function groupLinks(occurrences: LinkOccurrence[], pages: ReadonlyMap<string, LinkPage> = new Map(), sections:ReadonlyMap<string,string>=new Map()) {
  const groups = new Map<string, {key: string; destination: string; input: string | null; occurrences: LinkOccurrence[]}>();
  for (const occurrence of occurrences) {
    const value = occurrence.destination;
    let key: string | null, label: string;
    switch (value.mode) {
      case "url": key = urlKey(value.to); label = value.to.trim(); break;
      case "page": {
        const page = pages.get(value.to.pageId);
        key = page?.path ? urlKey(page.path) : `page:${value.to.pageId}`;
        label = page ? `${page.name}${page.path ? ` · ${page.path}` : ""}` : "Página interna";
        break;
      }
      case "pageSection": key = `section:${JSON.stringify(value.to.fullElementId)}`; label = sections.get(JSON.stringify(value.to.fullElementId)) ?? "Seção da página · destino não identificado"; break;
      case "email": label = `mailto:${value.to}${value.emailSubject ? `?subject=${encodeURIComponent(value.emailSubject)}` : ""}`; key = urlKey(label); break;
      case "phone": label = `tel:${value.to}`; key = urlKey(label); break;
      case "file": key = `file:${value.to.assetId}`; label = "Arquivo vinculado"; break;
    }
    if (!key) continue;
    const input = value.mode === "url" ? value.to : value.mode === "page" ? pages.get(value.to.pageId)?.path ?? null : null;
    const group = groups.get(key) ?? {key, destination: label, input, occurrences: []};
    if (!group.occurrences.some(item => item.id === occurrence.id)) group.occurrences.push(occurrence);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a,b) => b.occurrences.length - a.occurrences.length);
}

export type LinkDestinationGroup = ReturnType<typeof groupLinks>[number];
export type LinkFilter = "all" | "repeated" | "unique";
export function filterLinkGroups(groups: LinkDestinationGroup[], filter: LinkFilter) {
 return groups.filter(group => filter === "all" || (filter === "repeated" ? group.occurrences.length > 1 : group.occurrences.length === 1));
}
export function linkGroupCounts(groups: LinkDestinationGroup[]) {
 return {all: groups.length, repeated: filterLinkGroups(groups, "repeated").length, unique: filterLinkGroups(groups, "unique").length};
}
export function groupRepeatedLinks(occurrences: LinkOccurrence[], pages: ReadonlyMap<string, LinkPage> = new Map()) {
 return filterLinkGroups(groupLinks(occurrences, pages), "repeated");
}

export function prepareLinkPlan(context:PageContext,group:LinkDestinationGroup,selected:string[],url:string){
 if(url.trim()===group.input)throw new Error("Nenhuma alteração selecionada.");
 const ids=[...new Set(selected)];
 if(!ids.length||ids.some(id=>!group.occurrences.some(o=>o.targetId===id&&o.snapshot)))throw new Error("Seleção de links inválida.");
 const changes=ids.flatMap(id=>{
  const buttons=group.occurrences.filter(o=>o.targetId===id),first=buttons[0]!;
  const before=first.snapshot!,after=replaceLinkSnapshot(before,url);
  if(before===after)return [];
  const value=linkSnapshotSchema.parse(JSON.parse(before)).value;
  return [{id,before,after,source:first.source,link:{beforeLabel:group.destination,afterUrl:url,buttons:buttons.map(o=>`${o.text||o.label} · ${o.location}`.slice(0,500)),convertsPage:typeof value!=="string"&&["page","pageSection"].includes(value.mode)}}];
 });
 if(!changes.length)throw new Error("Nenhuma alteração selecionada.");
 return planSchema.parse({id:crypto.randomUUID(),context,expiresAt:Date.now()+15*60_000,changes});
}

export type LinkDraft = {url:string;selected:string[]};
export function initialLinkDraft(group:LinkDestinationGroup):LinkDraft {
 return {url:group.input??"",selected:[...new Set(group.occurrences.flatMap(o=>o.targetId?[o.targetId]:[]))]};
}
export function changedLinkDrafts(groups:LinkDestinationGroup[],drafts:Record<string,LinkDraft>) {
 return groups.flatMap(group=>{const draft=drafts[group.key];return draft&&draft.selected.length&&draft.url.trim()!==(group.input??"")?[{group,draft}]:[];});
}
export function prepareLinksPlan(context:PageContext,groups:LinkDestinationGroup[],drafts:Record<string,LinkDraft>) {
 if(Object.keys(drafts).some(key=>!groups.some(group=>group.key===key)))throw new Error("Seleção de links inválida.");
 const changes=changedLinkDrafts(groups,drafts).flatMap(({group,draft})=>prepareLinkPlan(context,group,draft.selected,draft.url.trim()).changes);
 if(!changes.length)throw new Error("Nenhuma alteração selecionada.");
 return planSchema.parse({id:crypto.randomUUID(),context,expiresAt:Date.now()+15*60_000,changes});
}
