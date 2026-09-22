import Link from "next/link";
import type { Scan } from "@/modules/scans/schema";

export function ScanCollectionCell({scan,href}:{scan:Scan;href:string}) {
  return <ul className="flex max-w-xs flex-wrap gap-1.5">
    {scan.plan.map(collection => <li key={collection.id} className="min-w-0 max-w-full">
      <Link
        href={href}
        title={collection.name}
        className="relative z-10 block max-w-40 truncate rounded-md border bg-subtle px-2 py-0.5 text-xs font-medium text-muted focus-visible:outline-2 focus-visible:outline-accent"
      >{collection.name}</Link>
    </li>)}
  </ul>;
}
