import { z } from "zod";
import { checkedJson, WebflowError } from "./client";
import { itemsSchema, webflowIdSchema } from "./schemas";

const updateSchema = z.strictObject({
  collectionId: webflowIdSchema, itemId: webflowIdSchema, locale: z.union([webflowIdSchema, z.literal("")]),
  field: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).refine((field) => !["__proto__", "constructor", "prototype", "slug"].includes(field)),
  value: z.json(),
});

// Only staged CMS fields. Publishing and live endpoints are intentionally absent.
export class WebflowWriter {
  constructor(private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}
  async updateField(input: z.input<typeof updateSchema>) {
    const data = updateSchema.parse(input);
    let response: Response;
    try {
      response = await this.fetcher("https://api.webflow.com/v2/collections/" + data.collectionId + "/items/" + data.itemId + "?skipInvalidFiles=false", {
        method: "PATCH", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...(data.locale ? { cmsLocaleId: data.locale } : {}), fieldData: { [data.field]: data.value } }),
      });
    } catch { throw new WebflowError("unavailable"); }
    const item = await checkedJson(response, itemsSchema.shape.items.element);
    if (item.id !== data.itemId || (data.locale && item.cmsLocaleId !== data.locale)) throw new WebflowError("invalid_response");
    return item;
  }
}
