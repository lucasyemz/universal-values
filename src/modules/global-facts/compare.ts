import { z } from "zod";
import { emailSchema, factsSchema, httpUrlSchema, phoneSchema, type GlobalFacts } from "./schema";

export const observationSchema = z.object({
  kind: z.enum(["phone", "email", "consultation_cta", "link", "text"]),
  value: z.string().min(1).max(10000),
  url: httpUrlSchema, location: z.string().min(1).max(500), excerpt: z.string().max(2000),
});
export type Observation = z.infer<typeof observationSchema>;
export type Comparison = {
  rule: "approved_phone" | "approved_email" | "approved_cta" | "forbidden_term" | "forbidden_domain";
  status: "match" | "mismatch" | "inconclusive";
  expected: string[]; found: string; evidence: Observation;
};

function phone(value: string) {
  const candidate = value.replace(/^tel:/i, "").replace(/[ ().-]/g, "");
  return phoneSchema.safeParse(candidate).success ? candidate : null;
}
function email(value: string) {
  let candidate = value;
  if (/^mailto:/i.test(value)) {
    // Extra recipients and encoded/ambiguous mailbox syntax require manual inspection.
    if (value.includes("?")) return null;
    try { candidate = decodeURIComponent(value.slice(7)); } catch { return null; }
  }
  if (!emailSchema.safeParse(candidate).success) return null;
  const at = candidate.lastIndexOf("@");
  return candidate.slice(0, at) + "@" + candidate.slice(at + 1).toLowerCase();
}
function url(value: string) {
  return httpUrlSchema.safeParse(value).success ? new URL(value).href : null;
}
function allowed(rule: Comparison["rule"], values: string[], observation: Observation, normalize: (s: string) => string | null): Comparison[] {
  if (!values.length) return [];
  const found = normalize(observation.value);
  return [{ rule, status: found === null ? "inconclusive" : values.some(value => normalize(value) === found) ? "match" : "mismatch", expected: values, found: observation.value, evidence: observation }];
}

// No network, extraction, AI, or publication claims. The caller must identify the
// business-contact/consultation context; a third-party phone is not a business fact.
export function compareObservations(input: GlobalFacts, observations: Observation[]): Comparison[] {
  const facts = factsSchema.parse(input);
  const rows = z.array(observationSchema).max(1000).parse(observations);
  return rows.flatMap(observation => {
    const result: Comparison[] = [];
    if (observation.kind === "phone") result.push(...allowed("approved_phone", facts.phones, observation, phone));
    if (observation.kind === "email") result.push(...allowed("approved_email", facts.emails, observation, email));
    if (observation.kind === "consultation_cta") result.push(...allowed("approved_cta", facts.ctaUrls, observation, url));
    if (observation.kind === "text") {
      const text = observation.value.normalize("NFC").toLowerCase();
      for (const term of facts.forbiddenTerms) {
        if (text.includes(term.normalize("NFC").toLowerCase())) result.push({ rule: "forbidden_term", status: "mismatch", expected: ["Ausência de: " + term], found: term, evidence: observation });
      }
    }
    if (["link", "consultation_cta"].includes(observation.kind) && facts.forbiddenDomains.length) {
      const parsed = url(observation.value);
      if (!parsed) result.push({ rule: "forbidden_domain", status: "inconclusive", expected: facts.forbiddenDomains.map(domain => "Não usar: " + domain), found: observation.value, evidence: observation });
      else {
        const host = new URL(parsed).hostname.toLowerCase().replace(/\.$/, "");
        for (const domain of facts.forbiddenDomains) {
          if (host === domain || host.endsWith("." + domain)) result.push({ rule: "forbidden_domain", status: "mismatch", expected: ["Não usar: " + domain], found: host, evidence: observation });
        }
      }
    }
    return result;
  });
}
