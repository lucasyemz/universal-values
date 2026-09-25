import { expect,it } from "vitest";
import {workspaceSlugSchema,workspaceEditInput,workspaceEditError} from "./edit";
it("accepts readable lower-case slugs and rejects malformed/reserved paths",()=>{
 for(const slug of ["kazama-test","outros-sites","1"])expect(workspaceSlugSchema.safeParse(slug).success).toBe(true);
 for(const slug of ["", "A", "foo bar", "a/b", "-foo", "foo-", "foo--bar", "settings", "a".repeat(81)])expect(workspaceSlugSchema.safeParse(slug).success).toBe(false);
 expect(workspaceEditInput.safeParse({id:"bad",workspace:"bad",name:"a",slug:"ok"}).success).toBe(false);
 expect(workspaceEditError({message:"WORKSPACE_SLUG_TAKEN"})).toContain("outro workspace");
});
