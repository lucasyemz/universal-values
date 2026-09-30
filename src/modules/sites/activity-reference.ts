import { z } from "zod";

export type ActivityReference = { label: "Busca" | "Variável" | "Exemplo de alteração"; before?: string; after?: string; imageUrl?: string };
export function referenceExcerpt(value: string) {
 const chars = [...value.replace(/\s+/g," ").trim()];
 return chars.length > 60 ? chars.slice(0,60).join("")+"…" : chars.join("");
}
const value = z.object({type:z.string(),text:z.string().optional(),url:z.string().optional(),number:z.string().optional(),amount:z.string().optional(),date:z.string().optional()});
function label(input:unknown) {
 const parsed=value.safeParse(input);
 if(!parsed.success)return undefined;
 const v=parsed.data;
 return v.text ?? v.url ?? v.number ?? v.amount ?? v.date;
}
export const cmsReferenceSchema=z.object({id:z.uuid(),managed_before:z.unknown(),managed_after:z.unknown(),replacement:z.unknown(),scan:z.object({search:z.string().nullable()}).nullable()});
export function cmsActivityReference(row:z.infer<typeof cmsReferenceSchema>):ActivityReference | undefined {
 const before=label(row.managed_before), after=label(row.managed_after) ?? label(row.replacement);
 const candidate = value.safeParse(label(row.managed_after) !== undefined ? row.managed_after : row.replacement);
 const image = candidate.success && candidate.data.type === "image" && candidate.data.url
   ? { imageUrl: candidate.data.url } : {};
 const search=row.scan?.search;
 if(before!==undefined)return {label:"Variável",before,after,...image};
 if(search)return {label:"Busca",before:search,after,...image};
 return after!==undefined ? {label:"Exemplo de alteração",after,...image} : undefined;
}
