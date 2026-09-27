import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.mjs"], {
    stdio: "inherit",
  }),
  spawn("npm", ["run", "dev:ui"], { stdio: "inherit" }),
];
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const c of children) c.kill("SIGTERM");
  process.exitCode = code;
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => stop());
for (const c of children) {
  c.on("exit", (code) => stop(code || 0));
  c.on("error", (e) => {
    console.error(e.message);
    stop(1);
  });
}
