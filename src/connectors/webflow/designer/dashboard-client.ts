import { z } from "zod";
import { homeSchema, sessionCodeSchema, type GatewayInput } from "../../../modules/static-text/protocol";
import { auditSchema, type AuditEvent, type AuditStore } from "../../../modules/static-text/apply";
import { planSchema, type TextPlan } from "../../../modules/static-text/plan";

import { readDesignerSession, saveDesignerSession, clearDesignerSession } from "./session-storage";

declare const DESIGNER_DASHBOARD_URL: string;
export const dashboardUrl = DESIGNER_DASHBOARD_URL;

export class DesignerAccessError extends Error {}

export class DesignerDashboardClient {
  private code = "";
  private site = "";
  constructor() {
    try { const saved = readDesignerSession(localStorage); if (saved) { this.code = saved.code; this.site = saved.site; } } catch { /* Reconnect if storage is unavailable. */ }
  }
  hasSession() { return !!this.code; }
  async connect(code: string, site: string) {
    const parsed = sessionCodeSchema.parse(code.trim());
    const previous = { code: this.code, site: this.site };
    this.code = parsed; this.site = site;
    try {
      const home = await this.home(site);
      saveDesignerSession(localStorage, { code: parsed, site, expiresAt: home.expiresAt });
      return home;
    } catch (error) { this.code = previous.code; this.site = previous.site; throw error; }
  }
  disconnect() { this.code = ""; this.site = ""; try { clearDesignerSession(localStorage); sessionStorage.removeItem("universal-values:designer-session:v1"); } catch { /* Storage unavailable. */ } }
  private async request(input: GatewayInput): Promise<unknown> {
    if (!this.code || input.webflowSiteId !== this.site) throw new DesignerAccessError("Conecte sua conta para este site.");
    let response: Response;
    try { response = await fetch(dashboardUrl + "/api/designer", { method: "POST", headers: { Authorization: "Bearer " + this.code, "Content-Type": "application/json" }, body: JSON.stringify(input), credentials: "omit", signal: AbortSignal.timeout(20000) }); }
    catch { throw new Error("Dashboard indisponível. Confira se está rodando e se a origem da extensão está autorizada. Uma operação enviada pode ter sido registrada; não repita a escrita manualmente."); }
    const envelope = z.object({ data: z.unknown().optional(), error: z.string().optional() }).parse(await response.json());
    if (response.status === 401) throw new DesignerAccessError(envelope.error ?? "Conecte sua conta para este site.");
    if (!response.ok) throw new Error(envelope.error ?? "Falha no histórico central.");
    return envelope.data;
  }
  async home(site: string) { return homeSchema.parse(await this.request({ action: "home", webflowSiteId: site })); }
  async preview(plan: TextPlan, searchText: string) { return planSchema.parse(await this.request({ action: "preview", webflowSiteId: plan.context.siteId, plan, searchText })); }
  store(plan: TextPlan): AuditStore {
    return {
      load: async () => z.array(auditSchema).parse(await this.request({ action: "events", webflowSiteId: plan.context.siteId, id: plan.id })),
      append: async (event: AuditEvent) => { z.literal(true).parse(await this.request({ action: "event", webflowSiteId: plan.context.siteId, id: plan.id, event })); },
    };
  }
}
