import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = root + "supabase/functions/webflow-userinfo/";
await mkdir(destination, { recursive: true });
await build({
  entryPoints: [root + "src/connectors/webflow/login-userinfo-handler.ts"],
  outfile: destination + "handler.js",
  bundle: true, platform: "neutral", format: "esm", target: "es2022",
  absWorkingDir: root,
});
await writeFile(destination + "index.js", 'import { webflowUserInfoHandler } from "./handler.js";\nDeno.serve(webflowUserInfoHandler);\n');
console.log("Webflow UserInfo Edge bundle ready (no credentials required).");
