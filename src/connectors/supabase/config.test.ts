import { afterEach, expect, it, vi } from "vitest";
import { getSupabaseConfig } from "./config";
afterEach(() => vi.unstubAllEnvs());

it("fails closed when configuration is missing", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  expect(getSupabaseConfig()).toBeNull();
});

it("supports HTTPS and local development but rejects insecure remote HTTP", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://remote.example.com");
  expect(getSupabaseConfig()).toBeNull();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  expect(getSupabaseConfig()).not.toBeNull();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  expect(getSupabaseConfig()).not.toBeNull();
});
