import { beforeEach, expect, it, vi } from "vitest";
const set=vi.hoisted(()=>vi.fn());
vi.mock("next/headers",()=>({cookies:async()=>({set})}));
import { setProductLanguage } from "./actions";
beforeEach(()=>vi.clearAllMocks());
it("persists the language across sessions without changing routes or account data",async()=>{
 await setProductLanguage("pt-BR");expect(set).toHaveBeenCalledWith("copyreplace-locale","pt-BR",expect.objectContaining({path:"/",maxAge:31536000,httpOnly:true,sameSite:"lax"}));
 await setProductLanguage("en");expect(set.mock.calls[1]?.[1]).toBe("en");
});
it("rejects unsupported values without setting a cookie",async()=>{
 await expect(setProductLanguage("../../secret")).rejects.toThrow();expect(set).not.toHaveBeenCalled();
});
