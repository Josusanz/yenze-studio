import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = (extra) =>
  spawnSync(process.execPath, ["scripts/preflight.mjs"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...extra },
  });
test("Launch preflight rejects insecure origins and incomplete payment configuration", () => {
  assert.equal(run({ APP_ORIGIN: "http://example.com" }).status, 1);
  assert.equal(
    run({ APP_ORIGIN: "https://example.com", STRIPE_SECRET_KEY: "test" })
      .status,
    1,
  );
  assert.equal(
    run({
      APP_ORIGIN: "https://example.com",
      STRIPE_SECRET_KEY: "test",
      STRIPE_WEBHOOK_SECRET: "hook",
    }).status,
    1,
  );
  assert.equal(run({ APP_ORIGIN: "https://example.com" }).status, 0);
  const full = run({
    APP_ORIGIN: "https://example.com",
    STRIPE_SECRET_KEY: "test",
    STRIPE_WEBHOOK_SECRET: "hook",
    RESEND_API_KEY: "mail-secret",
    MAIL_FROM: "hello@example.com",
  });
  assert.equal(full.status, 0);
  assert.ok(!full.stdout.includes("mail-secret"));
});
