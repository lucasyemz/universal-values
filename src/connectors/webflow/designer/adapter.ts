/// <reference types="@webflow/designer-extension-typings" />
import { contextSchema, nodeSchema, type PageContext, type TextNode } from "../../../modules/static-text/plan";
import type { TextPort } from "../../../modules/static-text/apply";
import { ComponentDefinitionText } from "./component-definition";
import { componentText } from "./component-text";
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
  private definitions = new ComponentDefinitionText();
  private elements = new Map<string, StringElement>();
  private paths = new Map<string, string[]>();
  private props = new Map<string, {path: string[]; propId: string; componentId: string}>();
  private propWrites = new Map<string, {element: ComponentElement; text: string}>();

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
    // Collection lookup can throw ResourceMissing on valid static pages.
    // Classify positively instead of treating a failed CMS lookup as static.
    const kind = await designerRead("page.getKind", () => page.getKind());
    if (kind !== "static") throw new Error("Abra uma página estática, não um template do CMS ou uma página especial.");
    const root = await designerRead("getRootElement", () => webflow.getRootElement());
    if (!root) throw new Error("A página não está disponível no Designer.");
    const site = await designerRead("getSiteInfo", () => webflow.getSiteInfo());
    const pageName = await designerRead("page.getName", () => page.getName());
    return contextSchema.parse({ siteId: site.siteId, pageId: page.id, pageName, rootId: key(root) });
  }

  async scan(includeComponents = false) {
    const context = await this.context();
    const nodes: TextNode[] = [];
    this.definitions = new ComponentDefinitionText();
    this.elements.clear();
    this.paths.clear();
    this.props.clear();
    this.propWrites.clear();
    let skipped = 0;
    let visited = 0;
    const seen = new Set<string>();
    const walk = async (element: AnyElement, parents: string[]): Promise<void> => {
      if (seen.has(key(element))) return;
      seen.add(key(element));
      if (++visited > 2000) throw new Error("Página acima do limite de 2.000 elementos deste teste.");
      if (includeComponents && element.type === "ComponentInstance") {
        const info = await componentText(element);
        const path = [...parents, key(element)];
        const internal = await this.definitions.scan(element, () => this.resolveInstance(path));
        nodes.push(...internal);
        if (!info || !info.props.length) {if (!internal.length) skipped++; return;}
        for (const prop of info.props) {
          const id = JSON.stringify(["component-prop", key(element), prop.id]);
          nodes.push(nodeSchema.parse({id, text:prop.text, source:{kind:"component-prop", componentName:info.name, propName:prop.label, instanceId:key(element), componentId:info.id, propId:prop.id}}));
          this.props.set(id, {path:[...parents,key(element)],propId:prop.id,componentId:info.id});
        }
        return;
      }
      // Never enter a component definition, CMS list or custom/code element.
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
    return { context, nodes, skipped, componentDiagnostics: this.definitions.diagnostics };
  }

  private async resolveInstance(path: string[]): Promise<ComponentElement | null> {
    let element = await webflow.getRootElement();
    for (let index = 0; index < path.length; index++) {
      if (!element || key(element) !== path[index]) return null;
      if (index === path.length - 1) return element.type === "ComponentInstance" && !await element.getParentComponent() ? element : null;
      if (!await isStatic(element) || !element.children) return null;
      element = (await element.getChildren()).find(child => key(child) === path[index + 1]) ?? null;
    }
    return null;
  }

  private async readProp(id: string): Promise<string | null> {
    this.propWrites.delete(id);
    const target = this.props.get(id);
    if (!target) return null;
    let element = await webflow.getRootElement();
    for (let index=0; index<target.path.length; index++) {
      if (!element || key(element)!==target.path[index]) return null;
      if (index===target.path.length-1) {
        if (element.type!=="ComponentInstance") return null;
        const info=await componentText(element);
        if (!info || info.id!==target.componentId) return null;
        const prop=info.props.find(prop=>prop.id===target.propId);
        if (!prop) return null;
        this.propWrites.set(id,{element,text:prop.text});
        return prop.text;
      }
      if (!await isStatic(element) || !element.children) return null;
      element=(await element.getChildren()).find(child=>key(child)===target.path[index+1])??null;
    }
    return null;
  }

  async read(id: string) {
    if (this.definitions.has(id)) return this.definitions.read(id);
    if (this.props.has(id)) return this.readProp(id);
    // Resolve and validate the full ancestor chain again without rescanning the page.
    this.elements.delete(id);
    const path = this.paths.get(id);
    if (!path) return null;
    let element = await webflow.getRootElement();
    for (let index = 0; index < path.length; index++) {
      if (!element || key(element) !== path[index] || !await isStatic(element)) return null;
      if (index === path.length - 1) {
        if (element.type !== "String") return null;
        const text = await element.getText();
        // Resolve independently from the current page registry too, rather than
        // trusting only the object reached through the scan's ancestor path.
        const current = (await designerRead("getAllElements", () => webflow.getAllElements())).find(item => key(item) === id);
        if (!current || current.type !== "String" || !await isStatic(current)) return null;
        if (await designerRead("String.getText", () => current.getText()) !== text) return null;
        this.elements.set(id, current);
        return text;
      }
      if (!element.children) return null;
      element = (await element.getChildren()).find(child => key(child) === path[index + 1]) ?? null;
    }
    return null;
  }

  async write(id: string, text: string) {
    if (this.definitions.has(id)) return this.definitions.write(id, text);
    const target = this.props.get(id);
    if (target) {
      const previous = this.propWrites.get(id);
      if (!previous || await this.readProp(id) !== previous.text) throw new Error("Elemento indisponível.");
      const current = this.propWrites.get(id);
      if (!current) throw new Error("Elemento indisponível.");
      await current.element.setProps([{propId:target.propId, value:text}]);
      return;
    }
    const element = this.elements.get(id);
    if (!element) throw new Error("Elemento indisponível.");
    await element.setText(text);
  }
}
