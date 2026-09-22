import {ImageTargets} from "./image-target";
import {prepareImagesPlan,type ImageDraft} from "../../../modules/static-text/image-plan";
import {scanImages} from "./image-scan";
import {boundedDesignerRead} from "./read-api";
import { LinkTargets } from "./link-target";
import { prepareLinksPlan, type LinkDraft } from "../../../modules/static-text/repeated-links";
import { scanRepeatedLinks } from "./link-scan";
import type { SearchOptions } from "../../../modules/text-search/match";
import { DesignerTextPort } from "./adapter";
import { DesignerDashboardClient } from "./dashboard-client";
import { applyPlan } from "../../../modules/static-text/apply";
import { findMentions, preparePlan, type TextPlan } from "../../../modules/static-text/plan";

export class DesignerController {
  private images=new ImageTargets();
  private links = new LinkTargets();
  readonly port = new DesignerTextPort();
  readonly dashboard = new DesignerDashboardClient();
  async identify() {
    if (typeof webflow === "undefined" || window.self === window.top) throw new Error("Abra o CopyReplace no Webflow Designer → Apps → Launch development app.");
    const site = await webflow.getSiteInfo();
    const page = await webflow.getCurrentPage();
    return { siteId: site.siteId, siteName: site.siteName, pageName: await page.getName() };
  }
  async search(term: string, options?: SearchOptions, includeComponents = false) {
    const scan = await this.port.scan(includeComponents);
    const home = await this.dashboard.home(scan.context.siteId);
    return { scan, home, mentions: findMentions(scan.nodes, term, options) };
  }
  async searchImages(includeComponents:boolean) {
    this.images.remote.dispose();
    this.images=new ImageTargets();
    return boundedDesignerRead(()=>scanImages(includeComponents,this.images));
  }
  imagePreviewUrl(asset:import("../../../modules/static-text/image-edit").ImageAsset){return this.images.remote.previewUrl(asset);}
  async previewImages(scan:Awaited<ReturnType<typeof scanImages>>,drafts:Record<string,ImageDraft>){
    const prepared:Record<string,ImageDraft>={};
    const resolved=new Map<string,Awaited<ReturnType<typeof this.images.remote.prepare>>>();
    for(const [key,draft] of Object.entries(drafts)){
      const url=draft.url?.trim();
      if(!draft.selected.length||!url||url===key)continue;
      let asset=resolved.get(url);
      if(!asset){asset=await this.images.remote.prepare(url);resolved.set(url,asset);}
      prepared[key]={...draft,asset};
    }
    const plan=prepareImagesPlan(scan.context,scan.groups,prepared);
    this.images.authorize(plan.changes.flatMap(c=>c.image?[c.image.asset]:[]));
    return this.dashboard.preview(plan,"Imagens da página");
  }
  async searchLinks(includeComponents: boolean) {
    this.links = new LinkTargets();
    const scan = await boundedDesignerRead(()=>scanRepeatedLinks(includeComponents, this.links));
    const home = await this.dashboard.home(scan.context.siteId);
    return {scan, home};
  }
  async previewLinks(scan:Awaited<ReturnType<typeof scanRepeatedLinks>>,drafts:Record<string,LinkDraft>){
    return this.dashboard.preview(prepareLinksPlan(scan.context,scan.groups,drafts),"Links da página");
  }
  async preview(scan: Awaited<ReturnType<DesignerTextPort["scan"]>>, term: string, replacements: Record<string, string>, options?: SearchOptions) {
    const plan = preparePlan(scan.context, scan.nodes, term, replacements, Date.now(), options);
    return this.dashboard.preview(plan, term);
  }
  async apply(plan: TextPlan, confirmed: boolean) {
    if (!navigator.locks) throw new Error("Este navegador não oferece o bloqueio necessário para aplicar com segurança.");
    await navigator.locks.request("universal-values-designer-write", { ifAvailable: true }, async lock => {
      if (!lock) throw new Error("Outra janela está aplicando alterações. Aguarde.");
      const port = plan.changes.every(change=>change.image)?{context:()=>this.port.context(),read:(id:string)=>this.images.read(id),write:(id:string,value:string)=>this.images.write(id,value)}:plan.changes.every(change=>change.link) ? {context:()=>this.port.context(),read:(id:string)=>this.links.read(id),write:(id:string,value:string)=>this.links.write(id,value)} : this.port;
      await applyPlan(plan, confirmed, port, this.dashboard.store(plan));
    });
  }
}
