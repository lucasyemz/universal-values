import { z } from "zod";

export const webflowIdSchema = z.string().regex(/^[0-9a-f]{24}$/i);
const localeSchema = z.object({ cmsLocaleId: z.string(), tag: z.string().max(100) });
export const siteSchema = z.object({
  id: webflowIdSchema, displayName: z.string().min(1).max(255), shortName: z.string(),
  locales: z.object({ primary: localeSchema.nullish(), secondary: z.array(localeSchema).optional() }).nullish(),
  customDomains: z.array(z.object({ url: z.string() })).optional(),
});
export const sitesSchema = z.object({ sites: z.array(siteSchema) });
export const collectionSchema = z.object({
  id: webflowIdSchema, displayName: z.string(), slug: z.string(),
});
export const collectionsSchema = z.object({ collections: z.array(collectionSchema) });
export const collectionDetailsSchema = collectionSchema.extend({
  fields: z.array(z.object({ id: z.string(), displayName: z.string(), slug: z.string(), type: z.string() })),
});
export const itemsSchema = z.object({
  items: z.array(z.object({
    id: webflowIdSchema, cmsLocaleId: z.string().optional(),
    isDraft: z.boolean(), isArchived: z.boolean(),
    fieldData: z.record(z.string(), z.json()),
  })),
  pagination: z.object({ limit: z.number().int().positive(), offset: z.number().int().nonnegative(), total: z.number().int().nonnegative() }),
});
export const tokenSchema = z.object({ access_token: z.string().min(1).max(8192), token_type: z.string().optional() });
export type WebflowSite = z.infer<typeof siteSchema>;
