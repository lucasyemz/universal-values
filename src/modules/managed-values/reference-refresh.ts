import { bindingSchema, type ManagedBinding } from "./sync-plan";
import { isRichTextRange } from "@/modules/scans/text-mentions";

// Conservative reattachment: never choose one of several identical candidates.
export function refreshTextReference(input: ManagedBinding, source: string): ManagedBinding {
  const binding = bindingSchema.parse(input);
  if (binding.uncertain || binding.canonical.type !== "text" || !["PlainText", "RichText"].includes(binding.field_type)) {
    throw new Error("Este vínculo exige revisão manual. A atualização de referência está disponível para texto sem resultado incerto.");
  }
  if (source.length > 20000) throw new Error("O campo excede o limite de revisão.");
  let previousEnd = 0;
  const locations = binding.locations.map(location => {
    if ([...binding.source_value].slice(location.start, location.end).join("") !== location.raw) throw new Error("Referência inválida. Revise o vínculo.");
    const index = source.indexOf(location.raw);
    if (index < 0 || source.indexOf(location.raw, index + 1) >= 0 || binding.source_value.indexOf(location.raw) !== binding.source_value.lastIndexOf(location.raw)) {
      throw new Error("O trecho vinculado mudou, desapareceu ou aparece mais de uma vez. Faça um novo scan para selecionar os trechos corretos.");
    }
    const start = [...source.slice(0, index)].length;
    const end = start + [...location.raw].length;
    if (binding.field_type === "RichText" && (!isRichTextRange(binding.source_value,location.start,location.end) || !isRichTextRange(source,start,end))) {
      throw new Error("O trecho não está em uma região de texto editável. Faça um novo scan para revisar o vínculo.");
    }
    if (start < previousEnd) throw new Error("A ordem dos trechos mudou. Faça um novo scan para revisar o vínculo.");
    previousEnd = end;
    return { start, end, raw: location.raw };
  });
  return { ...binding, source_value: source, locations };
}
