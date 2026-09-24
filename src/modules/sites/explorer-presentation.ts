import type {z} from "zod";
import type {itemsSchema} from "@/connectors/webflow/schemas";
export function filterExplorerItems(items:z.infer<typeof itemsSchema>["items"],query:string) {
 const needle=query.trim().toLocaleLowerCase();
 return needle?items.filter(item=>Object.values(item.fieldData).some(value=>(typeof value==='string'||typeof value==='number')&&String(value).toLocaleLowerCase().includes(needle))):items;
}
export function explorerItemDate(value:string|null|undefined,locale:string) {
 return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString(locale,{timeZone:'UTC'}):'—';
}
