import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cli = require.resolve("@playwright/test/cli");
const args = process.argv.slice(2);
// Each invocation owns its server, database and rate-limit state. A whole suite
// now creates more accounts than one real IP may register within ten minutes.
// Do not disable or raise the production protections to accommodate test traffic.
const groups = args.length ? [args] : [["--shard=1/2"], ["--shard=2/2"]];
for (const group of groups) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, "test", ...group], {
      stdio: "inherit",
      env: process.env,
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (code !== 0) {
    process.exitCode = Number(code);
    break;
  }
}
