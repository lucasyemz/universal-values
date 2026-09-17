import { afterEach, describe, expect, it, vi } from "vitest";
import { DesignerTextPort } from "./adapter";

function element(type: string, id: string, children: ReturnType<typeof leaf>[] = [], settings: unknown = {}) {
  return { type, id: { component: "page", element: id }, children: type !== "String", getChildren: async () => children,
    getParentComponent: async () => null, getSettings: async () => settings };
}
function leaf(id: string, text: string) {
  return { ...element("String", id), getSettings: vi.fn(async () => { throw new Error("Could not resolve element data type"); }), getText: vi.fn(async () => text), setText: vi.fn(async (next: string) => { text = next; return null; }) };
}
function install() {
  const text = leaf("text", "Minha EMPRESA!");
  const root = element("Body", "root", [text]);
  const api = { getCurrentComponent: async () => null, getCurrentPage: async () => ({ id: "page", isHomepage: async () => false, getCollectionId: async (): Promise<string | null> => null, getName: async () => "Home" }),
    getRootElement: async () => root, getSiteInfo: async () => ({ siteId: "site" }) };
  vi.stubGlobal("webflow", api);
  return { text, root, api };
}
afterEach(() => vi.unstubAllGlobals());
describe("Designer static text adapter", () => {
  it("scans a confirmed homepage without calling the failing CMS lookup", async () => {
    const f = install();
    const page = await f.api.getCurrentPage();
    const getCollectionId = vi.fn(async () => { throw new Error("Missing page 6aa9df72d986715c81ed4479."); });
    f.api.getCurrentPage = async () => ({ ...page, isHomepage: async () => true, getCollectionId });
    expect((await new DesignerTextPort().scan()).nodes).toHaveLength(1);
    expect(getCollectionId).not.toHaveBeenCalled();
    expect(f.text.setText).not.toHaveBeenCalled();
  });
  it("still blocks a CMS template", async () => {
    const f = install();
    const page = await f.api.getCurrentPage();
    f.api.getCurrentPage = async () => ({ ...page, getCollectionId: async () => "collection" });
    await expect(new DesignerTextPort().scan()).rejects.toThrow("não um template do CMS");
  });
  it("does not assume a homepage when its identification fails", async () => {
    const f = install();
    const page = await f.api.getCurrentPage();
    f.api.getCurrentPage = async () => ({ ...page, isHomepage: async () => { throw new Error("Permission denied"); } });
    await expect(new DesignerTextPort().scan()).rejects.toThrow("page.isHomepage");
    expect(f.text.getText).not.toHaveBeenCalled();
  });
  it("resolves a fresh handle for the exact page when metadata returns Missing page", async () => {
    const f = install();
    const goodPage = { ...await f.api.getCurrentPage(), type: "Page" };
    f.api.getCurrentPage = async () => ({ ...goodPage, getCollectionId: async () => { throw new Error("Missing page page."); } });
    vi.stubGlobal("webflow", { ...f.api, getAllPagesAndFolders: async () => [goodPage] });
    expect((await new DesignerTextPort().scan()).nodes).toHaveLength(1);
    expect(f.text.setText).not.toHaveBeenCalled();
  });
  it("never substitutes another page when the current ID is missing", async () => {
    const f = install();
    const goodPage = { ...await f.api.getCurrentPage(), type: "Page", id: "other" };
    f.api.getCurrentComponent = async () => { throw new Error("Missing page page."); };
    vi.stubGlobal("webflow", { ...f.api, getAllPagesAndFolders: async () => [goodPage] });
    await expect(new DesignerTextPort().scan()).rejects.toThrow("não aparece na lista");
    expect(f.text.setText).not.toHaveBeenCalled();
  });
  it("identifies the failing API when the page error persists", async () => {
    const f = install();
    const page = { ...await f.api.getCurrentPage(), type: "Page" };
    f.api.getCurrentComponent = async () => { throw new Error("Missing page page."); };
    vi.stubGlobal("webflow", { ...f.api, getAllPagesAndFolders: async () => [page] });
    await expect(new DesignerTextPort().scan()).rejects.toThrow("(getCurrentComponent): Missing page");
  });
  it("reads and writes only string leaves, leaving parent structure untouched", async () => {
    const f = install();
    const port = new DesignerTextPort();
    const scan = await port.scan();
    expect(scan.nodes.map(node => node.text)).toEqual(["Minha EMPRESA!"]);
    const id = scan.nodes[0]!.id;
    expect(await port.read(id)).toBe("Minha EMPRESA!");
    await port.write(id, "Minha PARCEIRA!");
    expect(f.text.setText).toHaveBeenCalledWith("Minha PARCEIRA!");
    expect(f.text.getSettings).not.toHaveBeenCalled();
    expect(await f.root.getChildren()).toEqual([f.text]);
  });
  it("excludes dynamically bound branches and rechecks eligibility before writing", async () => {
    const f = install();
    const port = new DesignerTextPort();
    const id = (await port.scan()).nodes[0]!.id;
    f.root.getSettings = async () => ({ textContent: { sourceType: "cms", fieldId: "field" } });
    expect(await port.read(id)).toBeNull();
    await expect(port.write(id, "other")).rejects.toThrow();
    expect((await port.scan()).nodes).toHaveLength(0);
  });
  it("rejects a removed or moved node", async () => {
    const f = install();
    const port = new DesignerTextPort();
    const id = (await port.scan()).nodes[0]!.id;
    f.root.getChildren = async () => [];
    expect(await port.read(id)).toBeNull();
    await expect(port.write(id, "other")).rejects.toThrow();
  });
  it("does not enter unsupported elements", async () => {
    const f = install();
    f.text.type = "RichText";
    expect((await new DesignerTextPort().scan()).nodes).toHaveLength(0);
    expect(f.text.getText).not.toHaveBeenCalled();
  });
});
