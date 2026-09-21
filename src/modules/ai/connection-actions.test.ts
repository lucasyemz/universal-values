import { beforeEach, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "@/connectors/webflow/crypto";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),validate:vi.fn(),generate:vi.fn(),auth:vi.fn()}));
vi.mock("@/modules/auth/service",()=>({requireUser:mocks.auth}));
vi.mock("next/navigation",()=>({unstable_rethrow:vi.fn()}));
vi.mock("@/connectors/gemini/client",()=>({validateGeminiKey:mocks.validate,generateSuggestion:mocks.generate}));
import {connectGemini,revokeGemini,suggestWithGemini} from "./connection-actions";
const id="20000000-0000-4000-8000-000000000001",user="user-id",secret="a".repeat(64),key="AQ."+"b".repeat(300);
const input={collection:"CMS",item:"Item",field:"Text",original:"Lorem",surrounding:"",facts:"Apartment in Recife with 3 rooms",language:"pt-BR"};
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("WEBFLOW_TOKEN_ENCRYPTION_KEY",secret);mocks.auth.mockResolvedValue({user:{id:user},client:{rpc:mocks.rpc}});mocks.validate.mockResolvedValue(undefined);});
it("validates before saving and only persists encrypted credentials",async()=>{
 mocks.rpc.mockResolvedValue({data:{id,expiresAt:"2026-10-21"},error:null});
 expect(await connectGemini({id,key,confirmed:true})).toMatchObject({ok:true});
 expect(mocks.validate).toHaveBeenCalledWith(key);
 const args=mocks.rpc.mock.calls[0]![1];expect(args.p_ciphertext).not.toContain(key);
 expect(decryptToken(args.p_ciphertext,`gemini:${user}:${id}`,secret)).toBe(key);
 expect(()=>decryptToken(args.p_ciphertext,`gemini:someone-else:${id}`,secret)).toThrow();
});
it("requires confirmation and never saves a key rejected by Google",async()=>{
 expect(await connectGemini({id,key,confirmed:false})).toMatchObject({ok:false});expect(mocks.auth).not.toHaveBeenCalled();
 mocks.validate.mockRejectedValue(new Error("Google refused"));expect(await connectGemini({id,key,confirmed:true})).toMatchObject({ok:false});expect(mocks.rpc).not.toHaveBeenCalled();
 expect(await revokeGemini({id,confirmed:false})).toMatchObject({ok:false});
});
it("does not generate without an active credential or over quota",async()=>{
 mocks.rpc.mockResolvedValue({error:{message:"private details"}});const result=await suggestWithGemini(input);expect(result.ok).toBe(false);expect(JSON.stringify(result)).not.toContain("private details");expect(mocks.generate).not.toHaveBeenCalled();
});
it("discards a generation if its connection was revoked",async()=>{
 mocks.rpc.mockResolvedValueOnce({data:{id,ciphertext:encryptToken(key,`gemini:${user}:${id}`,secret)},error:null}).mockResolvedValueOnce({data:null,error:null});mocks.generate.mockResolvedValue({text:"Example",needsContext:false});
 expect(await suggestWithGemini(input)).toMatchObject({ok:false});expect(mocks.generate).toHaveBeenCalledWith(key,input);
});
