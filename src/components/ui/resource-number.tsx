import { numberPattern } from "@/modules/routes/resources";

/** Display the existing public identity, including operation links into a scan. */
export function ResourceNumber({ href }: { href: string }) {
  const url = new URL(href, "https://dashboard.invalid");
  const number = url.searchParams.get("operation") ?? url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  return <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft px-1.5 text-xs font-semibold tabular-nums text-accent">
    {numberPattern.test(number) ? `#${number}` : "—"}
  </span>;
}
