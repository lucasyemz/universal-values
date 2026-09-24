import english from "./messages/en.json";
import portuguese from "./messages/pt-BR.json";
const ptCatalog: Record<string, string> = portuguese;
export type ProductLocale = "en" | "pt-BR";
export const productLocale = (value: string | undefined): ProductLocale => value === "pt-BR" ? "pt-BR" : "en";
const catalog: Record<string, string> = english;
const reverse = new Map(Object.entries(catalog).map(([pt,en]) => [en,pt]));
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.entries(catalog).filter(([key])=>/\{\d+\}/.test(key)).map(([pt,en])=>({pt,en,pattern:new RegExp("^"+pt.split(/\{\d+\}/).map(escape).join("([\\s\\S]*?)")+"$")}));
function buildText(locale: ProductLocale) {
  function text<T>(source: T, ...values: (string | number)[]): T extends string ? string : T {
    if (typeof source !== "string") return source as T extends string ? string : T;
    let result: string = source;
    if (locale === "en") {
      result = catalog[source] ?? source;
      if (result === source && !values.length) {
        // Historical status messages may already contain interpolated values.
        for (const entry of templates) {const match=entry.pattern.exec(source);if(match){result=entry.en.replace(/\{(\d+)\}/g,(_,i)=>match[Number(i)+1]??"");break;}}
        // Provider diagnostics append a safe HTTP code to a static message.
        if (result === source && source.includes(" · ")) result = source.split(" · ").map(part => catalog[part] ?? part).join(" · ");
        const suffix=source.match(/^(.*?)( \(HTTP \d{3}(?:; Google \d{3})?\))$/);
        if(suffix && catalog[suffix[1]!])result=catalog[suffix[1]!]!+suffix[2];
      }
    } else { const key = reverse.get(source) ?? source; result = ptCatalog[key] ?? key; }
    if(values.length)result=result.replace(/\{(\d+)\}/g,(_,i)=>String(values[Number(i)]??""));
    return result as T extends string ? string : T;
  }
  return Object.assign(text,{locale, dateLocale:locale === "en" ? "en-US" : "pt-BR"});
}

const translators = { en: buildText("en"), "pt-BR": buildText("pt-BR") };
export const createText = (locale: ProductLocale) => translators[locale];
