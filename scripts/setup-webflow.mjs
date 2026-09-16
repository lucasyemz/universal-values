import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const path = new URL("../.env.local", import.meta.url);
let content = existsSync(path) ? readFileSync(path, "utf8") : "";
const defaults = {
  WEBFLOW_CLIENT_ID: "",
  WEBFLOW_CLIENT_SECRET: "",
  WEBFLOW_REDIRECT_URI: "http://localhost:3000/api/connectors/webflow/callback",
  WEBFLOW_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
};
let changed = false;
for (const [name, value] of Object.entries(defaults)) {
  const pattern = new RegExp("^" + name + "=(.*)$", "m");
  const existing = content.match(pattern);
  if (!existing) {
    content = content.trimEnd() + "\n" + name + "=" + value + "\n";
    changed = true;
  } else if (name === "WEBFLOW_TOKEN_ENCRYPTION_KEY" && !existing[1]?.trim()) {
    content = content.replace(pattern, name + "=" + value);
    changed = true;
  }
}
if (changed) writeFileSync(path, content, { mode: 0o600 });
console.log(changed ? "Configuração Webflow preparada em .env.local. Nenhum segredo foi exibido." : "Configuração existente preservada.");
