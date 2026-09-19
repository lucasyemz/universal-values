import { build } from "esbuild";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = fileURLToPath(new URL("../.worker/cms.mjs", import.meta.url));
const envFile = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
await build({ entryPoints: [fileURLToPath(new URL("../src/modules/sync-worker/main.ts", import.meta.url))], outfile: output, bundle: true, packages: "external", platform: "node", format: "esm", target: "node22", absWorkingDir: root });
if (!process.argv.includes("--build")) {
  const child = spawn(process.execPath, [output], { cwd: root, env: process.env, stdio: "inherit" });
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("error", () => { console.error("Não foi possível iniciar o worker."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
