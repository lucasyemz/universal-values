import { afterEach, expect, it, vi } from "vitest";
import { DesignerTextPort } from "./adapter";
import { findMentions, preparePlan } from "../../../modules/static-text/plan";
import { applyPlan, type AuditEvent } from "../../../modules/static-text/apply";
import { componentLabel } from "../../../modules/static-text/component-label";
import { createText } from "../../../i18n/text";

function fixture() {
  type Node = {
    type: string; id: { component: string; element: string }; children: boolean;
    getChildren: () => Promise<Node[]>; getParentComponent: () => Promise<{id: string} | null>;
    getSettings: () => Promise<unknown>; getText?: () => Promise<string>; setText?: (value: string) => Promise<void>;
    getTag?: (options?: {bindings: true}) => Promise<unknown>; getAttributes?: () => Promise<unknown>;
    getComponent?: () => Promise<Definition>;
  };
  type Definition = { id: string; codeComponent: boolean; readOnly: boolean; getName: () => Promise<string>;
    getInstanceCount: () => Promise<number>; getRootElement: () => Promise<Node> };
  function node(type: string, id: string, owner: string | null, children: Node[] = []): Node {
    return { type, id: {component: owner ?? "page", element: id}, children: type !== "String",
      getChildren: async () => children, getParentComponent: async () => owner ? {id: owner} : null, getSettings: async () => ({}) };
  }
  function component(name: string) {
    let text = "Get for Free";
    const leaf = {...node("String", "text", name), getText: async () => text, setText: vi.fn(async (next: string) => {text = next;})};
    const button = node("Button", "button", name, [leaf]);
    const root = node("DivBlock", "root", name, [button]);
    const definition: Definition = {id: name, codeComponent: false, readOnly: false, getName: async () => name,
      getInstanceCount: async () => 4, getRootElement: async () => root};
    const instance = {...node("ComponentInstance", name, null), getComponent: async () => definition,
      searchProps: async () => [], setProps: vi.fn()};
    return {leaf, button, root, definition, instance};
  }
  const header = component("Header"), footer = component("Footer");
  const page = node("Body", "page-root", null, [header.instance, footer.instance]);
  const api = {getCurrentComponent: async () => null, getCurrentPage: async () => ({id: "page", getKind: async () => "static", getName: async () => "Home"}),
    getRootElement: async () => page, getSiteInfo: async () => ({siteId: "site"})};
  vi.stubGlobal("webflow", api);
  return {header, footer, page, node, api};
}
afterEach(() => vi.unstubAllGlobals());

it("finds internal Header/Footer CTA only when opted in and requires confirmation", async () => {
  const f = fixture(), port = new DesignerTextPort();
  expect((await port.scan(false)).nodes).toHaveLength(0);
  const scan = await port.scan(true), mentions = findMentions(scan.nodes, "Get for Free");
  expect(mentions).toHaveLength(2);
  expect(scan.nodes.map(node => node.source?.componentName)).toEqual(["Header", "Footer"]);
  expect(componentLabel(scan.nodes[0]!.source!, createText("en"))).toBe("Header · Shared component · 4 instances across the site");
  const plan = preparePlan(scan.context, scan.nodes, "Get for Free", Object.fromEntries(mentions.map(m => [m.key, "Try now"])));
  expect(plan.changes[0]?.source).toMatchObject({kind: "component-definition", instanceCount: 4});
  const events: AuditEvent[] = [], store = {load: () => events, append: (event: AuditEvent) => {events.push(event);}};
  await expect(applyPlan(plan, false, port, store, async () => {})).rejects.toThrow("Confirme");
  expect(f.header.leaf.setText).not.toHaveBeenCalled();
  await applyPlan(plan, true, port, store, async () => {});
  await applyPlan(plan, true, port, store, async () => {});
  expect(f.header.leaf.setText).toHaveBeenCalledExactlyOnceWith("Try now");
  expect(f.footer.leaf.setText).toHaveBeenCalledExactlyOnceWith("Try now");
  expect(f.header.instance.setProps).not.toHaveBeenCalled();
  expect(events.filter(e => e.status === "applied").map(e => e.observed)).toEqual(["Try now", "Try now"]);
});

it("deduplicates repeated and nested definitions", async () => {
  const f = fixture();
  const nested = {...f.footer.instance, getParentComponent: async () => ({id: "Header"})};
  f.header.root.getChildren = async () => [f.header.button, nested];
  f.page.getChildren = async () => [f.header.instance, {...f.header.instance, id: {component: "page", element: "copy"}}, f.footer.instance];
  const port = new DesignerTextPort(), scan = await port.scan(true);
  expect(scan.nodes).toHaveLength(2);
  expect(await port.read(scan.nodes[1]!.id)).toBe("Get for Free");
  f.header.root.getChildren = async () => [f.header.button];
  expect(await port.read(scan.nodes[1]!.id)).toBeNull();
});

it.each(["binding", "removed", "count", "readOnly", "definition", "owner"])("blocks a changed %s before any write", async kind => {
  const f = fixture(), port = new DesignerTextPort(), scan = await port.scan(true);
  const mentions = findMentions(scan.nodes, "Get for Free");
  const plan = preparePlan(scan.context, scan.nodes, "Get for Free", Object.fromEntries(mentions.map(m => [m.key, "New"])));
  if (kind === "binding") f.footer.button.getSettings = async () => ({text: {sourceType: "component-prop"}});
  if (kind === "removed") f.page.getChildren = async () => [f.header.instance];
  if (kind === "count") f.footer.definition.getInstanceCount = async () => 5;
  if (kind === "readOnly") f.footer.definition.readOnly = true;
  if (kind === "definition") f.footer.definition.id = "another";
  if (kind === "owner") f.footer.leaf.getParentComponent = async () => ({id: "another"});
  const events: AuditEvent[] = [];
  await expect(applyPlan(plan, true, port, {load: () => events, append: e => {events.push(e);}}, async () => {})).rejects.toThrow("Nenhuma nova escrita");
  expect(f.header.leaf.setText).not.toHaveBeenCalled();
  expect(f.footer.leaf.setText).not.toHaveBeenCalled();
  expect(events.at(-1)?.status).toBe("conflict");
});

it("does not overwrite a text changed after the last read", async () => {
  const f = fixture(), port = new DesignerTextPort(), scan = await port.scan(true), id = scan.nodes[0]!.id;
  await port.read(id);
  f.header.leaf.getText = async () => "Changed externally";
  await expect(port.write(id, "New")).rejects.toThrow();
  expect(f.header.leaf.setText).not.toHaveBeenCalled();
});

it("invalidates component targets when the checkbox is disabled", async () => {
  const f = fixture(), port = new DesignerTextPort(), scan = await port.scan(true), id = scan.nodes[0]!.id;
  await port.read(id);
  await port.scan(false);
  expect(await port.read(id)).toBeNull();
  await expect(port.write(id, "New")).rejects.toThrow();
  expect(f.header.leaf.setText).not.toHaveBeenCalled();
});

it("keeps a non-persisted component write uncertain and never retries it", async () => {
  const f = fixture(), port = new DesignerTextPort(), scan = await port.scan(true);
  f.header.leaf.setText.mockImplementation(async () => {});
  const mention = findMentions(scan.nodes, "Get for Free")[0]!;
  const plan = preparePlan(scan.context, scan.nodes, "Get for Free", {[mention.key]: "New"});
  const events: AuditEvent[] = [], store = {load: () => events, append: (e: AuditEvent) => {events.push(e);}};
  await expect(applyPlan(plan, true, port, store, async () => {})).rejects.toThrow("Não foi possível confirmar");
  expect(events.at(-1)?.status).toBe("uncertain");
  await expect(applyPlan(plan, true, port, store, async () => {})).rejects.toThrow("incerto");
  expect(f.header.leaf.setText).toHaveBeenCalledTimes(1);
  expect(events.some(e => e.status === "applied")).toBe(false);
});

it("skips property-bound text, CMS branches and read-only components", async () => {
  const f = fixture();
  f.header.button.getSettings = async () => ({text: {sourceType: "component-prop"}});
  f.footer.definition.readOnly = true;
  expect((await new DesignerTextPort().scan(true)).nodes).toHaveLength(0);
  f.header.button.getSettings = async () => ({});
  f.header.button.type = "CollectionList";
  expect((await new DesignerTextPort().scan(true)).nodes).toHaveLength(0);
});

it("finds and edits CTA text through DOM wrappers in Header and Footer without replacing their HTML", async () => {
  const f = fixture();
  for (const c of [f.header, f.footer]) {
    c.root.type = "DOM";
    c.root.getTag = async () => c === f.header ? "nav" : "footer";
    c.root.getAttributes = async () => [];
    c.button.type = "DOM";
    c.button.getTag = async () => "a";
    c.button.getAttributes = async () => [{name: "href", value: "https://example.com"}];
  }
  const port = new DesignerTextPort(), scan = await port.scan(true);
  const mentions = findMentions(scan.nodes, "Get for Free");
  expect(mentions).toHaveLength(2);
  const plan = preparePlan(scan.context, scan.nodes, "Get for Free", Object.fromEntries(mentions.map(m => [m.key, "Try now"])));
  const events: AuditEvent[] = [];
  await applyPlan(plan, true, port, {load: () => events, append: e => {events.push(e);}}, async () => {});
  expect(f.header.leaf.setText).toHaveBeenCalledExactlyOnceWith("Try now");
  expect(f.footer.leaf.setText).toHaveBeenCalledExactlyOnceWith("Try now");
  expect(await f.header.button.getAttributes!()).toEqual([{name: "href", value: "https://example.com"}]);
  expect(await f.header.button.getChildren()).toEqual([f.header.leaf]);
});

it.each(["script", "style", "iframe", "svg", "template", "my-widget"])("does not traverse DOM <%s>", async tag => {
  const f = fixture();
  f.header.root.type = "DOM";
  f.header.root.getTag = async () => tag;
  f.header.root.getAttributes = async () => [];
  const scan = await new DesignerTextPort().scan(true);
  expect(scan.nodes.map(n => n.source?.componentName)).toEqual(["Footer"]);
});

it.each(["tag", "attribute", "settings"])("blocks DOM %s bindings added after the scan", async kind => {
  const f = fixture();
  f.header.button.type = "DOM";
  f.header.button.getTag = async () => "button";
  f.header.button.getAttributes = async () => [];
  const port = new DesignerTextPort(), scan = await port.scan(true), id = scan.nodes[0]!.id;
  expect(await port.read(id)).toBe("Get for Free");
  if (kind === "tag") f.header.button.getTag = async () => ({sourceType: "prop", propId: "tag"});
  if (kind === "attribute") f.header.button.getAttributes = async () => [{name: "data-label", value: {sourceType: "cms", fieldId: "title"}}];
  if (kind === "settings") f.header.button.getSettings = async () => ({text: {sourceType: "prop", propId: "label"}});
  await expect(port.write(id, "Other")).rejects.toThrow();
  expect(f.header.leaf.setText).not.toHaveBeenCalled();
});

it("reads a nested button override and applies it to the shared Navbar, not the button definition", async () => {
  const f = fixture();
  let value = "Get for Free", bound = false;
  const setProps = vi.fn(async (props: {propId: string; value: string}[]) => {value = props[0]!.value;});
  const nested = {...f.footer.instance, getParentComponent: async () => ({id: "Header"}),
    searchProps: async () => [{propId: "cta", valueType: "textContent", value: {sourceType: bound ? "cms" : "static"}, resolvedValue: value, display: {label: "Button Text"}}], setProps};
  f.header.root.getChildren = async () => [nested];
  f.footer.button.getSettings = async () => ({text: {sourceType: "prop", propId: "cta"}});
  f.page.getChildren = async () => [f.header.instance];
  const port = new DesignerTextPort(), scan = await port.scan(true);
  expect(scan.nodes).toHaveLength(1);
  expect(scan.nodes[0]?.source).toMatchObject({componentId: "Header", componentName: "Header → Footer → Button Text", instanceCount: 4});
  const mention = findMentions(scan.nodes, "Get for Free")[0]!;
  const plan = preparePlan(scan.context, scan.nodes, "Get for Free", {[mention.key]: "Try now"});
  const events: AuditEvent[] = [], store = {load: () => events, append: (e: AuditEvent) => {events.push(e);}};
  expect(setProps).not.toHaveBeenCalled();
  await applyPlan(plan, true, port, store, async () => {});
  await applyPlan(plan, true, port, store, async () => {});
  expect(setProps).toHaveBeenCalledExactlyOnceWith([{propId: "cta", value: "Try now"}]);
  expect(f.footer.leaf.setText).not.toHaveBeenCalled();
  await port.read(scan.nodes[0]!.id);
  bound = true;
  await expect(port.write(scan.nodes[0]!.id, "Other")).rejects.toThrow();
  expect(setProps).toHaveBeenCalledTimes(1);
});
