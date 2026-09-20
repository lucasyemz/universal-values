import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
await build({
  entryPoints: [root + "src/connectors/supabase/edge-worker.ts"],
  outfile: root + "supabase/functions/cms-worker/worker.js",
  bundle: true, platform: "neutral", format: "esm", target: "es2022",
  absWorkingDir: root, external: ["node:*"],
  plugins: [{ name: "deno-pinned-packages", setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, args => {
      if (args.path.startsWith("@/") || args.path.startsWith("node:")) return;
      const name = args.path.startsWith("@") ? args.path.split("/").slice(0, 2).join("/") : args.path.split("/")[0];
      const version = lock.packages["node_modules/" + name]?.version;
      if (!version) throw new Error("Unpinned dependency: " + name);
      return { path: "npm:" + name + "@" + version + args.path.slice(name.length), external: true };
    });
  } }],
});
// JavaScript keeps the Deno-only entrypoint outside Next's TypeScript program.
await writeFile(root + "supabase/functions/cms-worker/index.js", `import { edgeWorker } from "./worker.js";\nDeno.serve(request => edgeWorker(request, {\n  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),\n  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),\n  WEBFLOW_TOKEN_ENCRYPTION_KEY: Deno.env.get("WEBFLOW_TOKEN_ENCRYPTION_KEY"),\n  CMS_WORKER_CRON_SECRET: Deno.env.get("CMS_WORKER_CRON_SECRET"),\n}));\n`);
console.log("Edge Function preparada em supabase/functions/cms-worker (sem acessar credenciais ou executar a fila).");
