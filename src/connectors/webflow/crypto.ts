import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { encryptionKeySchema } from "./config";

const stateSchema = z.string().regex(/^[0-9a-f-]{36}\.[0-9a-f]{64}$/);
export function newOAuthState(id: string) {
  z.uuid().parse(id);
  return id + "." + randomBytes(32).toString("hex");
}
export function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}
export function verifyOAuthState(state: string | null, cookie: string | undefined) {
  if (!state || !cookie || !stateSchema.safeParse(state).success) return null;
  const a = Buffer.from(state);
  const b = Buffer.from(cookie);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const id = state.split(".")[0];
  return z.uuid().safeParse(id).success ? id! : null;
}
export function encryptToken(token: string, context: string, key: string) {
  encryptionKeySchema.parse(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(".");
}
export function decryptToken(envelope: string, context: string, key: string) {
  encryptionKeySchema.parse(key);
  const parts = envelope.split(".");
  const [version, iv, tag, ciphertext] = parts;
  if (parts.length !== 4 || version !== "v1" || !iv || !/^[0-9a-f]{24}$/.test(iv) ||
      !tag || !/^[0-9a-f]{32}$/.test(tag) || !ciphertext || !/^(?:[0-9a-f]{2})+$/.test(ciphertext)) {
    throw new Error("Invalid encrypted credential");
  }
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(iv, "hex"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
}
