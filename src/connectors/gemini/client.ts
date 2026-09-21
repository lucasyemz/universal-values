import { z } from "zod";
import { aiKeySchema, suggestionSchema, type SuggestionInput } from "@/modules/ai/schema";
import { suggestionPrompt } from "@/modules/ai/prompt";
export const GEMINI_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const envelopeSchema = z.object({ candidates: z.array(z.object({ finishReason: z.string().optional(), content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }).optional() })).optional() });

// Personal credential only: no application key, retries or paid fallback.
export async function generateSuggestion(key: string, input: SuggestionInput, signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  const apiKey = aiKeySchema.parse(key);
  const prompt = suggestionPrompt(input);
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000);
  let response: Response;
  try {
    response = await fetcher(GEMINI_ENDPOINT, { method: "POST", credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
      signal: requestSignal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: prompt.instruction }] }, contents: [{ role: "user", parts: [{ text: prompt.data }] }],
        generationConfig: { candidateCount: 1, maxOutputTokens: 800, temperature: 1, thinkingConfig: { thinkingLevel: "minimal" }, responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { text: { type: "STRING" }, needsContext: { type: "BOOLEAN" } }, required: ["text", "needsContext"] } } }) });
  } catch { throw generationTransportError(requestSignal); }
  if (!response.ok) throw await geminiError(response);
  let payload: unknown;
  try { payload = await response.json(); } catch (error) {
    if (requestSignal.aborted || !(error instanceof SyntaxError)) throw generationTransportError(requestSignal);
    throw new Error("A IA não devolveu uma sugestão completa e válida. Revise o contexto antes de tentar novamente.");
  }
  try {
    const envelope = envelopeSchema.parse(payload);
    const candidate = envelope.candidates?.[0];
    if (candidate?.finishReason !== "STOP") throw new Error("Incomplete");
    const raw = candidate.content?.parts.filter(part => !part.thought).map(part => part.text ?? "").join("");
    const result = suggestionSchema.parse(JSON.parse(raw ?? ""));
    if (result.needsContext) return { text: "", needsContext: true };
    if (!result.text || /<\/?[a-z][^>]*>/i.test(result.text)) throw new Error("Invalid suggestion");
    return result;
  } catch { throw new Error("A IA não devolveu uma sugestão completa e válida. Revise o contexto antes de tentar novamente."); }
}

// Validate access without generating text or consuming generation tokens.
export async function validateGeminiKey(key: string, fetcher: typeof fetch = fetch) {
  const valid = aiKeySchema.parse(key);
  let response: Response;
  try {
    response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`, {
      headers: { "x-goog-api-key": valid }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error("Não foi possível acessar o Google. Tente novamente."); }
  if (!response.ok) throw await geminiError(response);
}

// Classify only known status codes; never expose Google's raw body or messages.
async function geminiError(response: Response) {
  let code = response.status;
  try {
    const payload = z.object({ error: z.object({ code: z.number().int().min(400).max(599) }) }).safeParse(await response.json());
    if (payload.success) code = payload.data.error.code;
  } catch { /* Proxies can return non-JSON errors. */ }
  const detail = ` (HTTP ${response.status}${code !== response.status ? `; Google ${code}` : ""})`;
  if (code === 429) return new Error("Cota do Gemini atingida. Confira os limites do seu projeto no Google AI Studio; não usamos uma chave paga como alternativa." + detail);
  if ([401,403].includes(code)) return new Error("O Google recusou esta chave ou o acesso do projeto. Confira a chave e as permissões da Gemini API em Integrações." + detail);
  if (code === 404) return new Error(`O modelo ${GEMINI_MODEL} não está disponível para este projeto Google. Confira o acesso ao modelo no AI Studio.` + detail);
  if (code === 400) return new Error("O Google rejeitou a solicitação. Confira as restrições da chave e a disponibilidade da Gemini API na sua região." + detail);
  if ([500,502,503,504].includes(code)) return new Error("O serviço do Gemini está temporariamente indisponível ou sobrecarregado. Tente novamente em alguns instantes." + detail);
  return new Error("Não foi possível gerar com o Gemini. Informe este código para verificarmos a integração." + detail);
}

function generationTransportError(signal: AbortSignal) {
  if (signal.aborted) {
    if (signal.reason instanceof Error && signal.reason.name === "TimeoutError") {
      return new Error("O Gemini não respondeu em até 60 segundos. Tente gerar novamente; seu texto foi mantido.");
    }
    return new Error("A geração foi cancelada. Seu texto foi mantido.");
  }
  return new Error("Não foi possível concluir a conexão com o Gemini. Tente gerar novamente; seu texto foi mantido.");
}
