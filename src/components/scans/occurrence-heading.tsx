import { occurrencePresentation } from "@/modules/scans/presentation";
import type { Occurrence } from "@/modules/scans/schema";
import { ImageThumbnail } from "./image-thumbnail";

export function OccurrenceHeading({ occurrence }: { occurrence: Occurrence }) {
  const display = occurrencePresentation(occurrence);
  return <span className="inline-flex max-w-full items-center gap-3 align-middle">
    {display.imageUrl && <ImageThumbnail url={display.imageUrl} alt={display.title} />}
    <span className="min-w-0">
      <span className="block break-words font-semibold">{display.title}</span>
      {display.subtitle && <span className="mt-1 block break-all text-sm font-normal text-faint">{display.subtitle}</span>}
    </span>
  </span>;
}
