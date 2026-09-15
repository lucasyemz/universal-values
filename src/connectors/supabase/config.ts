import { z } from "zod";

const configSchema = z.object({
  url: z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  }),
  key: z.string().min(1),
});

export function getSupabaseConfig() {
  const result = configSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return result.success ? result.data : null;
}
