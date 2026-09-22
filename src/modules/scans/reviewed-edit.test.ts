import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/service", () => ({ requireUser: vi.fn() }));
vi.mock("./service", () => ({ loadScanResults: vi.fn() }));
vi.mock("./slug-service", () => ({ prepareItemSlugs: vi.fn() }));
import { loadScanResults } from "./service";
import { requireUser } from "@/modules/auth/service";
import { previewChanges } from "./change-actions";
import { fixture, id } from "./inline-preview.fixture";
it("rejects editing reviewed occurrences before persisting a new preview", async () => {
 const { occurrences } = fixture();
 vi.mocked(loadScanResults).mockResolvedValue({scan:{status:"completed",plan:[{searchText:"Old"}]},occurrences,reviewedIds:[id],linkedValues:{},editableBoundOccurrenceIds:[]} as unknown as Awaited<ReturnType<typeof loadScanResults>>);
 expect(await previewChanges({id,scanId:id,changes:[{occurrenceId:id,after:{type:"text",text:"New"}}]})).toMatchObject({ok:false,message:expect.stringContaining("somente leitura")});
 expect(requireUser).not.toHaveBeenCalled();
});
