/// <reference types="@webflow/designer-extension-typings" />
import { contextSchema, nodeSchema, type PageContext, type TextNode } from "../../../modules/static-text/plan";
import type { TextPort } from "../../../modules/static-text/apply";
import { designerRead, isMissingPage } from "./read-api";

const key = (element: AnyElement) => JSON.stringify([element.id.component, element.id.element]);
function hasBinding(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if ("sourceType" in value) return true;
  return Object.values(value).some(hasBinding);
}
async function isStatic(element: AnyElement) {
  if (/Collection|Dynamo|Component|DOM|Code|Embed|RichText/.test(element.type)) return false;
  if (await designerRead(`${element.type}.getParentComponent`, () => element.getParentComponent())) return false;
  // String leaves expose getText/setText, but the runtime rejects getSettings.
  // Their complete ancestor chain is checked for bindings by scan() and read().
  if (element.type === "String") return true;
  return "getSettings" in element && !hasBinding(await designerRead(`${element.type}.getSettings`, () => element.getSettings()));
}

export class DesignerTextPort implements TextPort {
  private elements = new Map<string, StringElement>();
  private paths = new Map<string, string[]>();

  async context(): Promise<PageContext> {
    if (typeof window !== "undefined" && window.self === window.top) throw new Error("Abra a extensão dentro do Webflow Designer → Apps → Launch development app.");
    if (typeof webflow === "undefined") throw new Error("Abra esta extensão pelo Webflow Designer → Apps → Launch development app.");
    try { return await this.readContext(); }
    catch (error) {
      if (!isMissingPage(error)) throw error;
      // Retry only reads. Resolve a fresh handle for the exact current ID; never
      // substitute the homepage or another page when the selected page is missing.
      const pages = await designerRead("getAllPagesAndFolders", () => webflow.getAllPagesAndFolders());
      return this.readContext(pages);
    }
  }

  private async readContext(pages?: Array<Page | Folder>): Promise<PageContext> {
    const current = await designerRead("getCurrentPage", () => webflow.getCurrentPage());
    const listed = pages?.find((item): item is Page => item.type === "Page" && item.id === current.id);
    if (pages && !listed) throw new Error(`A página aberta (${current.id}) não aparece na lista de páginas do Designer. Recarregue o Designer e reabra a extensão.`);
    const page = listed ?? current;
    if (await designerRead("getCurrentComponent", () => webflow.getCurrentComponent())) throw new Error("Saia da edição de componentes para testar uma página estática.");
    // The Designer can reject getCollectionId on a static homepage instead of
    // returning null. A positively identified homepage needs no CMS lookup.
    const homepage = await designerRead("page.isHomepage", () => page.isHomepage());
    if (!homepage && await designerRead("page.getCollectionId", () => page.getCollectionId())) throw new Error("Abra uma página estática, não um template do CMS.");
    const root = await designerRead("getRootElement", () => webflow.getRootElement());
    if (!root) throw new Error("A página não está disponível no Designer.");
    const site = await designerRead("getSiteInfo", () => webflow.getSiteInfo());
    const pageName = await designerRead("page.getName", () => page.getName());
    return contextSchema.parse({ siteId: site.siteId, pageId: page.id, pageName, rootId: key(root) });
  }

  async scan() {
    const context = await this.context();
    const nodes: TextNode[] = [];
    this.elements.clear();
    this.paths.clear();
    let skipped = 0;
    let visited = 0;
    const seen = new Set<string>();
    const walk = async (element: AnyElement, parents: string[]): Promise<void> => {
      if (seen.has(key(element))) return;
      seen.add(key(element));
      if (++visited > 2000) throw new Error("Página acima do limite de 2.000 elementos deste teste.");
      // Do not enter CMS lists, reusable components or custom/code elements.
      if (!await isStatic(element)) { skipped++; return; }
      if (element.type === "String") {
        const text = await designerRead("String.getText", () => element.getText());
        if (typeof text !== "string" || text.length > 10000) { skipped++; return; }
        nodes.push(nodeSchema.parse({ id: key(element), text }));
        this.elements.set(key(element), element);
        this.paths.set(key(element), [...parents, key(element)]);
      } else if (element.children) {
        for (const child of await designerRead(`${element.type}.getChildren`, () => element.getChildren())) await walk(child, [...parents, key(element)]);
      }
    };
    const root = await designerRead("getRootElement", () => webflow.getRootElement());
    if (root) await walk(root, []);
    const end = await this.context();
    if (JSON.stringify(end) !== JSON.stringify(context)) throw new Error("A página mudou durante a busca. Tente novamente.");
    return { context, nodes, skipped };
  }

  async read(id: string) {
    // Resolve and validate the full ancestor chain again without rescanning the page.
    this.elements.delete(id);
    const path = this.paths.get(id);
    if (!path) return null;
    let element = await webflow.getRootElement();
    for (let index = 0; index < path.length; index++) {
      if (!element || key(element) !== path[index] || !await isStatic(element)) return null;
      if (index === path.length - 1) {
        if (element.type !== "String") return null;
        this.elements.set(id, element);
        return element.getText();
      }
      if (!element.children) return null;
      element = (await element.getChildren()).find(child => key(child) === path[index + 1]) ?? null;
    }
    return null;
  }

  async write(id: string, text: string) {
    const element = this.elements.get(id);
    if (!element) throw new Error("Elemento indisponível.");
    await element.setText(text);
  }
}
