// Isolated preview: no account tokens, real listings or environment file are copied.
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(path.join(root, "data"), { recursive: true });
const directory = await mkdtemp(path.join(root, "data", "research-preview-"));
if (path.dirname(path.resolve(directory)) !== path.resolve(root, "data") || !path.basename(directory).startsWith("research-preview-")) throw new Error("Preview directory is outside the test data folder.");
for (const file of await readdir(root)) {
  if ((file.endsWith(".mjs") && !file.endsWith(".test.mjs")) || file === "public" || file === "package.json") await cp(path.join(root, file), path.join(directory, file), { recursive: true });
}
const child = spawn(process.execPath, [path.join(directory, "server.mjs")], {
  stdio: "inherit", env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PORT: process.argv[2] || "5199", HOST: "127.0.0.1", CJ_USE_LIVE: "false", EBAY_ENV: "sandbox" }
});
async function clean() { child.kill(); await rm(directory, { recursive: true, force: true }); }
process.on("SIGINT", async () => { await clean(); process.exit(0); });
process.on("SIGTERM", async () => { await clean(); process.exit(0); });
child.on("exit", async () => { await rm(directory, { recursive: true, force: true }); });
