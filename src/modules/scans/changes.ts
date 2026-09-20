import { managedValueSchema, type ManagedValue } from "@/modules/managed-values/schema";
import { groupOccurrences, type Occurrence } from "./schema";
import { replacementSchema } from "./replacement-schema";

export function editableValue(value: ManagedValue): string {
  switch (value.type) {
    case "link": case "image": return value.url;
    case "text": return value.text;
    case "money": return value.amount;
    case "date": return value.date;
    case "number": case "phone": return value.number;
  }
}

export function replacementLabel(value: ManagedValue): string {
  return value.type === "text" && value.text === "" ? "Remover este trecho (sem substituição)" : editableValue(value);
}

export function replacementValue(original: ManagedValue, input: string) {
  const value = input.trim();
  switch (original.type) {
    case "link": case "image": return managedValueSchema.safeParse({ ...original, url: value });
    case "text": return replacementSchema.safeParse({ ...original, text: value });
    case "money": return managedValueSchema.safeParse({ ...original, amount: value });
    case "date": return managedValueSchema.safeParse({ ...original, date: value });
    case "number": case "phone": return managedValueSchema.safeParse({ ...original, number: value });
  }
}

export function prepareOccurrenceChanges(occurrences: Occurrence[], inputs: Record<string, string>) {
  const changes: { occurrenceId: string; before: ManagedValue; after: ManagedValue }[] = [];
  const errors: Record<string, string> = {};
  for (const occurrence of occurrences) {
    const input = inputs[occurrence.id];
    if (input === undefined || input === editableValue(occurrence.canonical)) continue;
    const result = replacementValue(occurrence.canonical, input);
    if (!result.success) {
      errors[occurrence.id] = "Valor inválido para este tipo. Confira o formato indicado.";
    } else if (JSON.stringify(result.data) !== JSON.stringify(occurrence.canonical)) {
      changes.push({ occurrenceId: occurrence.id, before: occurrence.canonical, after: result.data });
    }
  }
  return { changes, errors };
}

export function fillOccurrenceValues(occurrences: Occurrence[], inputs: Record<string, string>, value: string) {
  if (new Set(occurrences.map((o) => JSON.stringify(o.canonical))).size !== 1) throw new Error("O preenchimento em conjunto exige valores originais iguais.");
  return { ...inputs, ...Object.fromEntries(occurrences.map((o) => [o.id, value])) };
}

export function isRepeatedGroupSelection(occurrences: Occurrence[], ids: string[], includeSingles = false) {
  if (!ids.length || new Set(ids).size !== ids.length) return false;
  return groupOccurrences(occurrences, true, includeSingles).some((group) => {
    const allowed = new Set(group.occurrences.map((o) => o.id));
    return ids.every((id) => allowed.has(id));
  });
}

export const inputHints: Record<ManagedValue["type"], string> = {
  link: "URL de destino, como https://exemplo.com/cadastro",
  image: "URL pública da imagem (https://…)",
  text: "Texto desejado. Deixe vazio para remover somente este trecho; espaços e pontuação ao redor serão mantidos.",
  number: "Número decimal com ponto, como 12.5",
  money: "Quantia decimal com ponto, como 99.90; a moeda será mantida",
  phone: "Telefone internacional, como +5511999999999",
  date: "Data no formato AAAA-MM-DD",
};
