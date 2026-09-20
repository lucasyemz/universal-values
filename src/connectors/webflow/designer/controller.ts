import { DesignerTextPort } from "./adapter";
import { DesignerDashboardClient } from "./dashboard-client";
import { applyPlan } from "../../../modules/static-text/apply";
import { findMentions, preparePlan, type TextPlan } from "../../../modules/static-text/plan";

export class DesignerController {
  readonly port = new DesignerTextPort();
  readonly dashboard = new DesignerDashboardClient();
  async identify() {
    if (typeof webflow === "undefined" || window.self === window.top) throw new Error("Abra o CopyReplace no Webflow Designer → Apps → Launch development app.");
    const site = await webflow.getSiteInfo();
    const page = await webflow.getCurrentPage();
    return { siteId: site.siteId, siteName: site.siteName, pageName: await page.getName() };
  }
  async search(term: string) {
    const scan = await this.port.scan();
    await this.dashboard.home(scan.context.siteId);
    return { scan, mentions: findMentions(scan.nodes, term) };
  }
  async preview(scan: Awaited<ReturnType<DesignerTextPort["scan"]>>, term: string, replacements: Record<string, string>) {
    const plan = preparePlan(scan.context, scan.nodes, term, replacements);
    return this.dashboard.preview(plan, term);
  }
  async apply(plan: TextPlan, confirmed: boolean) {
    if (!navigator.locks) throw new Error("Este navegador não oferece o bloqueio necessário para aplicar com segurança.");
    await navigator.locks.request("universal-values-designer-write", { ifAvailable: true }, async lock => {
      if (!lock) throw new Error("Outra janela está aplicando alterações. Aguarde.");
      await applyPlan(plan, confirmed, this.port, this.dashboard.store(plan));
    });
  }
}
