import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const extension = path.join(root, "extensions/webflow-designer");
const out = path.join(extension, "dist");
await mkdir(out, { recursive: true });
await build({ entryPoints: [path.join(root, "src/connectors/webflow/designer/extension.tsx")], bundle: true, outfile: path.join(out, "index.js"), platform: "browser", target: "es2022", jsx: "automatic", minify: true, define: { "process.env.NODE_ENV": '"production"' } });
await Promise.all(["index.html", "styles.css"].map(file => copyFile(path.join(extension, file), path.join(out, file))));
console.log("Extensão compilada em extensions/webflow-designer/dist.");
const mode = process.argv[2];
if (mode === "serve" || mode === "bundle") {
  const cli = path.join(root, "node_modules/@webflow/webflow-cli/dist/index.js");
  const child = spawn(process.execPath, [cli, "extension", mode, "--skip-update-check"], { cwd: extension, stdio: "inherit", windowsHide: true, env: { ...process.env, DO_NOT_TRACK: "1" } });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
