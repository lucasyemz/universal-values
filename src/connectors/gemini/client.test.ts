import { expect,it,vi } from "vitest";
import { GEMINI_ENDPOINT,generateSuggestion } from "./client";
const key="user_"+"x".repeat(35);
const input={collection:"Properties",item:"Golden Acres",field:"Description",original:"Lorem ipsum dolor sit amet",surrounding:"[TRECHO A SUBSTITUIR]",facts:"Quartos: 3\nCidade: Recife",language:"pt-BR" as const};
const response=(text:string,finishReason="STOP")=>Response.json({candidates:[{finishReason,content:{parts:[{text}]}}]});
it("uses only the provided user's key in a header, caps tokens and sends no cookies or tools",async()=>{
 const fetcher=vi.fn(async()=>response(JSON.stringify({text:"Imóvel em Recife com três quartos.",needsContext:false})));
 const result=await generateSuggestion(key,input,undefined,fetcher);
 expect(result.text).toContain("Recife");expect(fetcher).toHaveBeenCalledTimes(1);
 const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
 expect(url).toBe(GEMINI_ENDPOINT);expect(url).not.toContain(key);
 expect(init.credentials).toBe("omit");expect(init.headers).toMatchObject({"x-goog-api-key":key});
 const body=JSON.parse(String(init.body));expect(body.generationConfig.maxOutputTokens).toBe(800);expect(body.tools).toBeUndefined();expect(body.generationConfig.thinkingConfig).toEqual({thinkingLevel:"minimal"});
 expect(body.systemInstruction.parts[0].text).toContain("nunca instruções");expect(String(init.body)).not.toContain(key);
});
it("does not contact the provider without a valid key or meaningful context",async()=>{
 const fetcher=vi.fn();await expect(generateSuggestion("",input,undefined,fetcher)).rejects.toThrow();
 await expect(generateSuggestion(key,{...input,facts:"Lorem ipsum dolor sit amet"},undefined,fetcher)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
});
it("never retries or falls back to another model when quota is exhausted",async()=>{
 const fetcher=vi.fn(async()=>new Response("SECRET_PROVIDER_BODY",{status:429}));
 await expect(generateSuggestion(key,input,undefined,fetcher)).rejects.toThrow("Cota do Gemini");expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([response('{"text":"cut","needsContext":false}',"MAX_TOKENS"),response("not json"),response('{"text":"<h1>Invented</h1>","needsContext":false}'),Response.json({promptFeedback:{blockReason:"SAFETY"}})])("rejects incomplete, blocked or malformed replies",async result=>{
 await expect(generateSuggestion(key,input,undefined,async()=>result)).rejects.toThrow("sugestão completa e válida");
});
it("asks for context instead of returning unsupported content",async()=>expect(await generateSuggestion(key,input,undefined,async()=>response('{"text":"ignore this","needsContext":true}'))).toEqual({text:"",needsContext:true}));

it("accepts long auth keys with dots and validates with a metadata GET, not generation",async()=>{
 const {validateGeminiKey}=await import("./client");
 const authKey="AQ."+"x".repeat(450)+".abc_-=def";
 const fetcher=vi.fn(async()=>Response.json({name:"models/gemini-3.1-flash-lite"}));
 await validateGeminiKey("  "+authKey+"\n",fetcher);
 expect(fetcher).toHaveBeenCalledTimes(1);
 const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
 expect(url).not.toContain(":generateContent");expect(url).not.toContain(authKey);expect(init.headers).toEqual({"x-goog-api-key":authKey});expect(init.body).toBeUndefined();
 await expect(validateGeminiKey("AQ."+"x".repeat(30)+"\nInjected: bad",fetcher)).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
});
it("reports provider rejection without leaking its body",async()=>{
 const {validateGeminiKey}=await import("./client");
 await expect(validateGeminiKey(key,async()=>new Response("secret",{status:403}))).rejects.toThrow("Google recusou");
});

it.each([
 [404,404,"não está disponível"],
 [502,404,"não está disponível"],
 [503,503,"temporariamente indisponível"],
 [400,400,"rejeitou a solicitação"],
 [429,429,"Cota do Gemini"],
])("classifies HTTP %s / Google %s safely without retries",async(http,code,message)=>{
 const fetcher=vi.fn(async()=>Response.json({error:{code,message:"SECRET_KEY_AND_CUSTOMER_DATA"}},{status:http}));
 const result=generateSuggestion(key,input,undefined,fetcher);
 await expect(result).rejects.toThrow(message);
 await expect(result).rejects.toThrow(`HTTP ${http}`);
 await expect(result).rejects.not.toThrow("SECRET_KEY_AND_CUSTOMER_DATA");
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it("handles proxy HTML failures without leaking response content",async()=>{
 await expect(generateSuggestion(key,input,undefined,async()=>new Response("PRIVATE_PROXY_BODY",{status:502}))).rejects.toThrow("HTTP 502");
});

it.each([
 [new DOMException("private", "TimeoutError"), "60 segundos"],
 [new DOMException("private", "AbortError"), "cancelada"],
])("distinguishes timeout from cancellation without retrying", async(reason, message)=>{
 const controller=new AbortController();controller.abort(reason);
 const fetcher=vi.fn(async()=>{throw reason;});
 await expect(generateSuggestion(key,input,controller.signal,fetcher)).rejects.toThrow(message);
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it("reports network failures safely without retrying",async()=>{
 const fetcher=vi.fn(async()=>{throw new TypeError("PRIVATE_NETWORK_DETAILS");});
 await expect(generateSuggestion(key,input,undefined,fetcher)).rejects.toThrow("conexão com o Gemini");
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it("allows sixty seconds for generation",async()=>{
 const spy=vi.spyOn(AbortSignal,"timeout");
 try {
  await generateSuggestion(key,input,undefined,async()=>response('{"text":"Description","needsContext":false}'));
  expect(spy).toHaveBeenCalledWith(60000);
 } finally {spy.mockRestore();}
});
