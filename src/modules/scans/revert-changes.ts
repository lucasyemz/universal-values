import type { FieldChange } from "./change-plan";

type AppliedResult = { sourceKey: string; status: string; actual?: FieldChange["before"] };
export function buildRevertPlan(plan: FieldChange[], results: AppliedResult[]): FieldChange[] {
  return plan.map((field) => {
    const result = results.find((r) => r.sourceKey === field.sourceKey && r.status === "applied");
    if (!result || result.actual === undefined) throw new Error("Resultado aplicado indisponível para reversão.");
    return { ...field, before: result.actual, after: field.before };
  });
}

export function reversibleFieldCount(results: AppliedResult[]) {
  return results.filter((r) => r.status === "applied" && r.actual !== undefined).length;
}
