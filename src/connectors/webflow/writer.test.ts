import { describe, expect, it, vi } from "vitest";
import { WebflowWriter } from "./writer";
import { WebflowReader } from "./client";

const collectionId = "a".repeat(24), itemId = "b".repeat(24), locale = "c".repeat(24);
const item = { id: itemId, cmsLocaleId: locale, isDraft: false, isArchived: false, fieldData: { link: "/new" } };
describe("confirmed CMS writer connector", () => {
  it("writes only one staged field and requested locale, with no publication or status changes", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(item));
    await new WebflowWriter("token", fetcher).updateField({ collectionId, itemId, locale, field: "link", value: "/new" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}?skipInvalidFiles=false`);
    const options = fetcher.mock.calls[0]?.[1];
    expect(options).toMatchObject({ method: "PATCH", redirect: "error", cache: "no-store" });
    expect(JSON.parse(options!.body as string)).toEqual({ cmsLocaleId: locale, fieldData: { link: "/new" } });
  });
  it("does not retry uncertain writes or expose provider bodies", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("provider secret"));
    await expect(new WebflowWriter("token", fetcher).updateField({ collectionId, itemId, locale, field: "link", value: "/new" })).rejects.toThrow("unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a response for another item or locale", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...item, cmsLocaleId: "d".repeat(24) }));
    await expect(new WebflowWriter("token", fetcher).updateField({ collectionId, itemId, locale, field: "link", value: "/new" })).rejects.toThrow("invalid_response");
  });
  it("validates identifiers before writing and reads the selected locale", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(item));
    await expect(new WebflowWriter("token", fetcher).updateField({ collectionId: "../x", itemId, locale, field: "link", value: "/new" })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await new WebflowReader("token", fetcher).item(collectionId, itemId, locale);
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}?cmsLocaleId=${locale}`);
  });
});

it('allows a reviewed slug only alongside the item name in the same staged PATCH',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({...item,fieldData:{name:'Novo nome',slug:'novo-nome'}}));
  const writer=new WebflowWriter('token',fetcher);
  await writer.updateField({collectionId,itemId,locale,field:'name',value:'Novo nome',slug:'novo-nome'});
  expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({cmsLocaleId:locale,fieldData:{name:'Novo nome',slug:'novo-nome'}});
  await expect(writer.updateField({collectionId,itemId,locale,field:'description',value:'Novo nome',slug:'novo-nome'})).rejects.toThrow();
  await expect(writer.updateField({collectionId,itemId,locale,field:'slug',value:'novo-nome'})).rejects.toThrow();
  await expect(writer.updateField({collectionId,itemId,locale,field:'name',value:'',slug:'novo-nome'})).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
