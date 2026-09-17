import { z } from "zod";
import type { WebflowConfig } from "./config";
import { collectionDetailsSchema, collectionsSchema, itemsSchema, sitesSchema, tokenSchema, webflowIdSchema } from "./schemas";

export class WebflowError extends Error {
  constructor(public readonly kind: "unauthorized" | "forbidden" | "rate_limit" | "unavailable" | "invalid_response", public readonly retryAfter?: number) {
    super("Webflow request failed: " + kind);
  }
}

export async function checkedJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) throw new WebflowError("unauthorized");
    if (response.status === 403) throw new WebflowError("forbidden");
    if (response.status === 429) {
      const retry = Number(response.headers.get("retry-after") ?? 60);
      throw new WebflowError("rate_limit", Number.isFinite(retry) && retry >= 0 ? retry : 60);
    }
    throw new WebflowError("unavailable");
  }
  try {
    return schema.parse(await response.json());
  } catch {
    // Never expose provider bodies, headers, codes or tokens in errors.
    throw new WebflowError("invalid_response");
  }
}

export async function exchangeCode(config: WebflowConfig, code: string, fetcher: typeof fetch = fetch) {
  z.string().min(1).max(4096).parse(code);
  let response: Response;
  try {
    response = await fetcher("https://api.webflow.com/oauth/access_token", {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, grant_type: "authorization_code", redirect_uri: config.redirectUri }),
    });
  } catch {
    throw new WebflowError("unavailable");
  }
  return (await checkedJson(response, tokenSchema)).access_token;
}

export class WebflowReader {
  constructor(private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}

  protected async get<T>(path: string, schema: z.ZodType<T>) {
    let response: Response;
    try {
      response = await this.fetcher("https://api.webflow.com/v2" + path, {
        method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Authorization: "Bearer " + this.token, Accept: "application/json" },
      });
    } catch {
      throw new WebflowError("unavailable");
    }
    return checkedJson(response, schema);
  }

  async sites() { return (await this.get("/sites", sitesSchema)).sites; }
  async item(collectionId: string, itemId: string, locale = "") {
    const query = locale ? "?cmsLocaleId=" + webflowIdSchema.parse(locale) : "";
    return this.get("/collections/" + webflowIdSchema.parse(collectionId) + "/items/" + webflowIdSchema.parse(itemId) + query, itemsSchema.shape.items.element);
  }
  async collections(siteId: string) {
    return (await this.get("/sites/" + webflowIdSchema.parse(siteId) + "/collections", collectionsSchema)).collections;
  }
  async collection(collectionId: string) {
    return this.get("/collections/" + webflowIdSchema.parse(collectionId), collectionDetailsSchema);
  }
  async items(collectionId: string, offset = 0) {
    z.number().int().min(0).max(1000000).parse(offset);
    return this.get("/collections/" + webflowIdSchema.parse(collectionId) + "/items?limit=25&offset=" + offset, itemsSchema);
  }
}
