import type { Activity } from "./model";

export type ActivityVisibility = { items: Activity[]; completedAt: Record<string, number> };

// Keep successful outcomes briefly; active work and unresolved issues remain visible.
export function updateActivityVisibility(previous: ActivityVisibility, incoming: Activity[], now: number): ActivityVisibility {
  const completedAt: Record<string, number> = {};
  const items = incoming.filter(item => {
    if (item.state !== "done") return true;
    const key = `${item.kind}:${item.id}`;
    completedAt[key] = previous.completedAt[key] ?? now;
    return now - completedAt[key] < 15000;
  });
  return { items, completedAt };
}
