import { z } from "zod";

const singleLine = (max: number) => z.string().trim().max(max).regex(/^[^\p{Cc}]*$/u, "Use uma única linha, sem caracteres de controle.");
export const phoneSchema = z.string().regex(/^\+[1-9][0-9]{7,14}$/, "Use formato internacional, como +18086265477.");
// Deliberately conservative: no display names, internationalized addresses or recipient lists.
export const emailSchema = z.string().max(254).regex(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/, "Informe um e-mail simples.");
export const domainSchema = z.string().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Use somente o domínio, em minúsculas, sem protocolo ou caminho.");
export const httpUrlSchema = z.string().max(2048).refine(value => {
  if (!/^https?:\/\/[^\s\\]+$/.test(value) || !URL.canParse(value)) return false;
  const url = new URL(value);
  return !!url.hostname && !url.username && !url.password;
}, "Use uma URL HTTP ou HTTPS completa, sem credenciais.");
const list = <T extends z.ZodType<string>>(item: T) => z.array(item).max(20).refine(values => new Set(values).size === values.length, "Remova os valores repetidos.");

export const factsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  businessName: singleLine(160).min(1, "Informe o nome do negócio."),
  sourceNotes: z.string().trim().min(3, "Identifique a fonte de referência.").max(2000),
  phones: list(phoneSchema),
  emails: list(emailSchema),
  ctaUrls: list(httpUrlSchema),
  forbiddenTerms: list(singleLine(160).min(2)),
  forbiddenDomains: list(domainSchema),
  notes: z.string().trim().max(5000),
});
export type GlobalFacts = z.infer<typeof factsSchema>;
export const emptyFacts: GlobalFacts = { schemaVersion: 1, businessName: "", sourceNotes: "", phones: [], emails: [], ctaUrls: [], forbiddenTerms: [], forbiddenDomains: [], notes: "" };

export const factsVersionSchema = z.object({
  site_id: z.uuid(), version: z.number().int().positive(), facts: factsSchema,
  actor_id: z.uuid(), preview_id: z.uuid(), created_at: z.string(),
});
export const factsPreviewSchema = z.object({
  id: z.uuid(), site_id: z.uuid(), actor_id: z.uuid(), base_version: z.number().int().nonnegative(),
  archived_at: z.string().nullable().default(null),
  facts: factsSchema, created_at: z.string(), expires_at: z.string(), confirmed_version: z.number().int().positive().nullable(),
});
export const previewInputSchema = z.object({ id: z.uuid(), siteId: z.uuid(), baseVersion: z.number().int().nonnegative(), facts: factsSchema });
export const confirmationSchema = z.object({ id: z.uuid(), siteId: z.uuid(), confirmed: z.literal("yes") });

export function factsFromForm(form: FormData) {
  const lines = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : value;
  };
  return previewInputSchema.safeParse({
    id: form.get("id"), siteId: form.get("siteId"),
    baseVersion: /^\d+$/.test(String(form.get("baseVersion"))) ? Number(form.get("baseVersion")) : -1,
    facts: { schemaVersion: 1, businessName: form.get("businessName"), sourceNotes: form.get("sourceNotes"),
      phones: lines("phones"), emails: lines("emails"), ctaUrls: lines("ctaUrls"),
      forbiddenTerms: lines("forbiddenTerms"), forbiddenDomains: lines("forbiddenDomains"), notes: form.get("notes") },
  });
}

export const factFields = [
  { key: "businessName", label: "Nome do negócio", help: "Nome de referência. Não cria uma regra de equivalência entre marcas ou razões sociais.", max: 160, required: true },
  { key: "sourceNotes", label: "Fonte de referência", help: "Quem aprovou estas informações e em qual documento ou data? Registre a origem para futuras revisões.", max: 2000, required: true },
  { key: "phones", label: "Telefones aprovados", help: "Um por linha, com + e código do país, sem espaços. Exemplo de formato: +18086265477.", max: 400 },
  { key: "emails", label: "E-mails aprovados", help: "Um por linha. Somente endereços simples, sem nomes de contato.", max: 5100 },
  { key: "ctaUrls", label: "Destinos aprovados para CTAs de consulta", help: "Uma URL completa por linha. A regra só se aplica a links identificados como CTAs de consulta, não a todos os links.", max: 41000 },
  { key: "forbiddenTerms", label: "Trechos proibidos", help: "Um por linha. Busca literal sem diferenciar maiúsculas; não deduz sinônimos. Deixe vazio até confirmar a lista.", max: 3300 },
  { key: "forbiddenDomains", label: "Domínios proibidos", help: "Um domínio em minúsculas por linha, sem https://. Inclui seus subdomínios.", max: 5100 },
  { key: "notes", label: "Outros fatos e limites", help: "Horários, endereço, honorários, razão social e exceções ainda são referências para revisão humana; não são verificados automaticamente nesta etapa.", max: 5000 },
] as const;
export function factDisplay(facts: GlobalFacts, key: typeof factFields[number]["key"], missing = "Não informado") {
  const value = facts[key];
  return (Array.isArray(value) ? value.join("\n") : value) || missing;
}
