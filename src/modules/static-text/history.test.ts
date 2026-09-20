import { describe, expect, it } from "vitest";
import { summarizeDesignerChange } from "./history";
import type { AuditEvent } from "./apply";
const plan = { id: "00000000-0000-4000-8000-000000000001", context: { siteId: "site", pageId: "page", pageName: "Contato", rootId: "root" }, expiresAt: 2000, changes: [{ id: "a", before: "A", after: "B" }, { id: "b", before: "A", after: "B" }] };
const event = (status: AuditEvent["status"], nodeId?: string): AuditEvent => ({ plan, status, nodeId, at: "2026-01-01T00:00:00Z", confirmedAt: "2026-01-01T00:00:00Z" });
const summarize = (events: AuditEvent[], now = 1000) => summarizeDesignerChange({ plan, events, expires_at: new Date(2000).toISOString() }, now);
describe("Designer history summaries", () => {
  it("distinguishes previews, expiry and confirmation from verified writes", () => {
    expect(summarize([]).status).toBe("Aguardando confirmação");
    expect(summarize([], 3000).status).toBe("Prévia expirada");
    expect(summarize([event("confirmed")], 3000).status).toBe("Confirmada · sem resultado verificado");
  });
  it("counts unique verified nodes and includes already updated content", () => {
    const result = summarize([event("applied", "a"), event("applied", "a"), event("already_applied", "b")]);
    expect(result.verified).toBe(2);
    expect(result.status).toBe("Verificada no Designer");
    expect(result.pageName).toBe("Contato");
  });
  it("keeps partial and uncertain outcomes distinct", () => {
    expect(summarize([event("applied", "a")]).status).toBe("Parcialmente verificada");
    for (const status of ["dispatching", "uncertain"] as const) {
      const result = summarize([event("applied", "a"), event(status, "b")]);
      expect(result.status).toBe("Resultado pendente de verificação");
      expect(result.verified).toBe(1);
    }
  });
  it("uses latest node outcome and ignores unrelated plans", () => {
    expect(summarize([event("applied", "a"), event("conflict", "a")]).verified).toBe(0);
    expect(summarize([event("conflict", "a")]).status).toBe("Conflito de conteúdo");
    expect(summarize([{ ...event("applied", "a"), plan: { ...plan, id: "00000000-0000-4000-8000-000000000002" } }]).verified).toBe(0);
    expect(summarize([event("dispatching", "a"), event("applied", "a"), event("applied", "b")]).status).toBe("Verificada no Designer");
  });
});
