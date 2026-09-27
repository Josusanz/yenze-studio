import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("Production serves compiled UI and restricts embeds to the merchant domains", async (t) => {
  if (!existsSync(new URL("../dist/index.html", import.meta.url))) {
    t.skip("Run npm run build to verify production HTTP.");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "yenze-prod-")),
    port = 31782;
  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      APP_ORIGIN: "https://studio.example",
      YENZE_DATA_DIR: dir,
      STRIPE_SECRET_KEY: "",
    },
    stdio: "pipe",
  });
  let logs = "";
  child.stderr.on("data", (v) => (logs += v));
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((r) => child.once("exit", r));
    }
    rmSync(dir, { recursive: true, force: true });
  });
  const base = "http://127.0.0.1:" + port;
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (n === 79) throw Error(logs);
  }
  let cookie = "";
  const call = async (path, method = "GET", data) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "https://studio.example",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    assert.ok(r.ok, await r.clone().text());
    if (r.headers.get("set-cookie")) {
      assert.match(r.headers.get("set-cookie"), /Secure/);
      assert.match(r.headers.get("set-cookie"), /HttpOnly/);
      cookie = r.headers.get("set-cookie").split(";")[0];
    }
    return r;
  };
  const root = await call("/");
  assert.match(await root.text(), /assets\/index-/);
  assert.match(
    root.headers.get("content-security-policy"),
    /frame-ancestors 'self'/,
  );
  await call("/api/auth/signup", "POST", {
    email: "prod@example.test",
    name: "Owner",
    company: "Prod",
    password: "test-password-123",
  });
  const p = await (
    await call("/api/products", "POST", { template: "shirt" })
  ).json();
  await call("/api/products/" + p.id + "/publish", "POST", {
    revision: p.revision,
  });
  await call("/api/workspace", "PATCH", {
    name: "Prod",
    accent: "#223344",
    domains: ["https://shop.example"],
  });
  const embed = await call("/?product=" + p.id + "&embed=1");
  assert.match(
    embed.headers.get("content-security-policy"),
    /frame-ancestors 'self' https:\/\/shop.example/,
  );
  const readableEmbed = await call(p.publicPath + "?embed=1");
  assert.match(
    readableEmbed.headers.get("content-security-policy"),
    /https:\/\/shop.example/,
  );
  assert.match(await readableEmbed.text(), /assets\/index-/);
  const normal = await call("/?product=" + p.id);
  assert.doesNotMatch(
    normal.headers.get("content-security-policy"),
    /shop.example/,
  );
});
