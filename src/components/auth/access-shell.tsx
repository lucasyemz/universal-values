import type { ReactNode } from "react";
import { Brand } from "@/components/layout/brand";
import { getText } from "@/i18n/server";

export async function AccessShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const t = await getText();
  return <main className="flex min-h-screen items-center justify-center bg-surface px-6 py-12">
    <section className="w-full max-w-md rounded-xl border border-line bg-white p-8">
      <a href="/" className="mb-6 inline-flex"><Brand /></a>
      <h1 className="mt-6 text-2xl font-semibold">{t(title)}</h1><p className="mt-3 text-sm text-muted">{t(description)}</p>
      {children}
    </section>
  </main>;
}
