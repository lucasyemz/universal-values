import { expect, it, vi } from "vitest";
import { createAiWorkLock } from "./work-lock";
it("blocks overlapping individual and group requests until the current work finishes",()=>{
 const change=vi.fn(),lock=createAiWorkLock(change);
 const release=lock.acquire();expect(release).not.toBeNull();expect(lock.acquire()).toBeNull();
 expect(change).toHaveBeenCalledExactlyOnceWith(true);
 release!();expect(change).toHaveBeenLastCalledWith(false);
 const next=lock.acquire();expect(next).not.toBeNull();release!();expect(lock.acquire()).toBeNull();next!();
 expect(lock.acquire()).not.toBeNull();
});
