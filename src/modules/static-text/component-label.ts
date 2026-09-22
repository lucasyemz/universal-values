import type { TextNode } from "./plan";

export function componentLabel(source: NonNullable<TextNode["source"]>, t: (text: string, ...values: Array<string | number>) => string) {
  if (source.kind === "component-definition") {
    return `${source.componentName} · ${t("Componente compartilhado · {0} instâncias no site", source.instanceCount)}`;
  }
  return `${source.componentName} → ${source.propName} · ${t("Componente · somente esta instância")}`;
}
