"use server";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { encryptToken, decryptToken } from "@/connectors/webflow/crypto";
import { encryptionKeySchema } from "@/connectors/webflow/config";
import { generateSuggestion, validateGeminiKey } from "@/connectors/gemini/client";
import { aiKeySchema, suggestionInputSchema } from "./schema";

const statusSchema = z.object({ id: z.uuid(), expiresAt: z.string() }).nullable();
function encryptionKey() {
  const key = encryptionKeySchema.safeParse(process.env.WEBFLOW_TOKEN_ENCRYPTION_KEY);
  if (!key.success) throw new Error("A criptografia das integrações não está configurada no servidor.");
  return key.data;
}
const context = (userId: string, id: string) => `gemini:${userId}:${id}`;
function failure(error: unknown) {
  unstable_rethrow(error);
  // Only our own controlled errors are exposed; never database/provider payloads.
  return { ok: false as const, message: error instanceof Error ? error.message : "Não foi possível acessar a integração." };
}
export async function geminiStatus() {
  const { client } = await requireUser();
  const { data, error } = await client.rpc("gemini_connection", { p_action: "status" });
  if (error) return { ok: false as const, message: "Não foi possível carregar o Gemini. Confira se a migration de integrações foi aplicada." };
  return { ok: true as const, connection: statusSchema.parse(data) };
}
export async function connectGemini(input: unknown) {
  const parsed = z.strictObject({ id: z.uuid(), key: aiKeySchema, confirmed: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Cole a chave completa do Google AI Studio, sem aspas, e confirme a conexão." };
  try {
    const { client, user } = await requireUser();
    const secret = encryptionKey();
    await validateGeminiKey(parsed.data.key);
    const ciphertext = encryptToken(parsed.data.key, context(user.id, parsed.data.id), secret);
    const { data, error } = await client.rpc("gemini_connection", { p_action: "connect", p_id: parsed.data.id, p_ciphertext: ciphertext });
    if (error) throw new Error("Não foi possível salvar a conexão. Confira a migration de integrações; se já estiver conectado, revogue antes de trocar a chave.");
    const connection = statusSchema.parse(data);
    if (!connection || connection.id !== parsed.data.id) throw new Error("Esta tentativa já foi encerrada. Abra novamente a conexão.");
    return { ok: true as const, connection };
  } catch (error) { return failure(error); }
}
export async function revokeGemini(input: unknown) {
  const parsed = z.strictObject({ id: z.uuid(), confirmed: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Confirme qual conexão deseja revogar." };
  const { client } = await requireUser();
  const { error } = await client.rpc("gemini_connection", { p_action: "revoke", p_id: parsed.data.id });
  if (error) return { ok: false as const, message: "Não foi possível revogar a conexão. Tente novamente." };
  return { ok: true as const };
}
export async function suggestWithGemini(input: unknown) {
  const parsed = suggestionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Revise as informações reais do item antes de gerar." };
  try {
    const { client, user } = await requireUser();
    const secret = encryptionKey();
    const { data, error } = await client.rpc("gemini_connection", { p_action: "claim" });
    if (error) throw new Error("Confira sua conexão em Integrações. O limite é de 20 gerações por dia, com 10 segundos entre pedidos.");
    const credential = z.object({ id: z.uuid(), ciphertext: z.string() }).parse(data);
    let key: string;
    try { key = decryptToken(credential.ciphertext, context(user.id, credential.id), secret); }
    catch { throw new Error("Reconecte o Gemini em Integrações para atualizar sua credencial."); }
    const suggestion = await generateSuggestion(key, parsed.data);
    const after = await client.rpc("gemini_connection", { p_action: "status" });
    if (after.error || statusSchema.parse(after.data)?.id !== credential.id) throw new Error("A conexão foi revogada ou expirou durante a geração.");
    return { ok: true as const, suggestion };
  } catch (error) { return failure(error); }
}
