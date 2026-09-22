/// <reference types="@webflow/designer-extension-typings" />
import { nodeSchema, type TextNode } from "../../../modules/static-text/plan";
import { editableComponentText } from "./component-text";

const key = (element: AnyElement) => JSON.stringify([element.id.component, element.id.element]);
// Traverse ordinary content containers, not executable/embedded/custom elements.
const contentTags = new Set("a abbr address article aside b bdi bdo blockquote button caption cite code dd del details dfn div dl dt em figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup i ins kbd label legend li main mark nav ol p pre q s samp section small span strong sub summary sup table tbody td tfoot th thead time tr u ul var".split(" "));
function bound(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return "sourceType" in value || Object.values(value).some(bound);
}
async function eligible(element: AnyElement, owner: string, report?: (reason: string) => void) {
  if (/Collection|Dynamo|Component|Code|Embed|RichText/.test(element.type)) {report?.(`${element.type}: unsupported type`); return false;}
  const parent = await element.getParentComponent();
  if (!parent || parent.id !== owner) {report?.(`${element.type}: ${parent ? "different owner" : "no parent component"}; ID owner matches: ${element.id.component === owner}`); return false;}
  if (element.type === "String") return true;
  if (element.type === "DOM") {
    const tag = await element.getTag({bindings: true});
    if (typeof tag !== "string" || !contentTags.has(tag.toLowerCase())) {
      report?.(`DOM: unsupported or bound tag (${typeof tag === "string" ? tag : "binding"})`);
      return false;
    }
    if (bound(await element.getAttributes())) {report?.(`DOM <${tag}>: bound attributes`); return false;}
  }
  if (!("getSettings" in element)) {report?.(`${element.type}: settings unavailable`); return false;}
  const settings = await element.getSettings();
  if (bound(settings)) {report?.(`${element.type}: bound settings (${Object.keys(settings).join(", ")})`); return false;}
  return true;
}
async function resolvePath(root: AnyElement | null, path: string[], owner: string) {
  let element = root;
  for (let i = 0; i < path.length; i++) {
    if (!element || key(element) !== path[i]) return null;
    if (i === path.length - 1) return element;
    if (!await eligible(element, owner) || !element.children) return null;
    element = (await element.getChildren()).find(child => key(child) === path[i + 1]) ?? null;
  }
  return null;
}
type ResolveInstance = () => Promise<ComponentElement | null>;
type TextHandle = { getText: () => Promise<string | null>; setText: (text: string) => Promise<unknown> };
type Target = { resolve: () => Promise<TextHandle | null> };

// Only definitions reachable from an opted-in page instance are scanned. Shared
// definitions are deduplicated; instance properties stay in the separate adapter.
export class ComponentDefinitionText {
  readonly diagnostics: string[] = [];
  private definitions = new Set<string>();
  private targets = new Map<string, Target>();
  private writes = new Map<string, { element: TextHandle; text: string }>();
  private visited = 0;
  has(id: string) { return this.targets.has(id); }

  async scan(instance: ComponentElement, resolveInstance: ResolveInstance): Promise<TextNode[]> {
    const component = await instance.getComponent();
    if (component.codeComponent || component.readOnly) {
      this.diagnostics.push(`${await component.getName()}: code or read-only component`);
      return [];
    }
    if (this.definitions.has(component.id)) return [];
    this.definitions.add(component.id);
    const componentId = component.id;
    const componentName = await component.getName();
    this.diagnostics.push(`${componentName}: reading definition`);
    const instanceCount = await component.getInstanceCount();
    const currentComponent = async () => {
      const current = await resolveInstance();
      if (!current) return null;
      const definition = await current.getComponent();
      if (definition.id !== componentId || definition.codeComponent || definition.readOnly) return null;
      // A changed global footprint needs a fresh preview as well.
      if (await definition.getInstanceCount() !== instanceCount) return null;
      return definition;
    };
    const nodes: TextNode[] = [];
    const seen = new Set<string>();
    const walk = async (element: AnyElement, parents: string[]): Promise<void> => {
      if (seen.has(key(element))) return;
      seen.add(key(element));
      if (++this.visited > 2000) throw new Error("Componentes acima do limite de 2.000 elementos. Refine a busca.");
      const path = [...parents, key(element)];
      if (element.type === "ComponentInstance") {
        const resolveNested = async () => {
          const current = await currentComponent();
          if (!current) return null;
          const nested = await resolvePath(await current.getRootElement(), path, componentId);
          if (!nested || nested.type !== "ComponentInstance" || (await nested.getParentComponent())?.id !== componentId) return null;
          return nested;
        };
        // An override on a button inside Navbar belongs to the shared Navbar
        // definition. Reading only the button definition misses that CTA.
        const nestedDefinition = await element.getComponent();
        const nestedComponentId = nestedDefinition.id;
        if (!nestedDefinition.codeComponent && !nestedDefinition.readOnly && typeof element.searchProps === "function" && typeof element.setProps === "function") {
          const nestedName = await nestedDefinition.getName();
          for (const prop of editableComponentText(await element.searchProps())) {
            const id = JSON.stringify(["component-nested-prop", componentId, key(element), prop.id]);
            nodes.push(nodeSchema.parse({id, text: prop.text, source: {kind: "component-definition", componentId, componentName: `${componentName} → ${nestedName} → ${prop.label}`, instanceCount}}));
            this.targets.set(id, {resolve: async () => {
              const nested = await resolveNested();
              if (!nested) return null;
              const definition = await nested.getComponent();
              if (definition.id !== nestedComponentId || definition.codeComponent || definition.readOnly) return null;
              const currentProp = editableComponentText(await nested.searchProps()).find(p => p.id === prop.id);
              if (!currentProp) return null;
              return {getText: async () => currentProp.text, setText: text => nested.setProps([{propId: prop.id, value: text}])};
            }});
          }
        }
        nodes.push(...await this.scan(element, resolveNested));
        return;
      }
      if (!await eligible(element, componentId, reason => {if (this.diagnostics.length < 30) this.diagnostics.push(`${componentName}: ${reason}`);})) return;
      if (element.type === "String") {
        const text = await element.getText();
        if (typeof text !== "string" || text.length > 10000) return;
        const id = JSON.stringify(["component-definition", componentId, key(element)]);
        nodes.push(nodeSchema.parse({ id, text, source: { kind: "component-definition", componentId, componentName, instanceCount } }));
        this.targets.set(id, { resolve: async () => {
          const current = await currentComponent();
          if (!current) return null;
          const leaf = await resolvePath(await current.getRootElement(), path, componentId);
          return leaf?.type === "String" && await eligible(leaf, componentId) ? leaf : null;
        } });
      } else if (element.children) {
        for (const child of await element.getChildren()) await walk(child, path);
      }
    };
    const root = await component.getRootElement();
    if (root) await walk(root, []);
    else this.diagnostics.push(`${componentName}: no root returned`);
    this.diagnostics.push(`${componentName}: ${nodes.length} text nodes`);
    return nodes;
  }

  async read(id: string) {
    this.writes.delete(id);
    const element = await this.targets.get(id)?.resolve();
    if (!element) return null;
    const text = await element.getText();
    if (typeof text !== "string" || text.length > 10000) return null;
    this.writes.set(id, { element, text });
    return text;
  }
  async write(id: string, text: string) {
    const previous = this.writes.get(id);
    if (!previous || await this.read(id) !== previous.text) throw new Error("Elemento indisponível.");
    const current = this.writes.get(id);
    if (!current) throw new Error("Elemento indisponível.");
    await current.element.setText(text);
  }
}
