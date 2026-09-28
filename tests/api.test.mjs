import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
test("Tenant isolation, publishing, immutable configurations and quote lifecycle", async (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yenze-api-")),
    port = 31781;
  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      YENZE_DATA_DIR: dir,
      STRIPE_SECRET_KEY: "",
      APP_ORIGIN: "http://localhost:" + port,
    },
    stdio: "pipe",
  });
  let logs = "";
  child.stderr.on("data", (d) => (logs += d));
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((r) => child.once("exit", r));
    }
    rmSync(dir, { recursive: true, force: true });
  });
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(`http://localhost:${port}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (n === 79) throw Error(logs);
  }
  function client() {
    let cookie = "";
    return async (
      route,
      method = "GET",
      data,
      expected = 200,
      headers = {},
    ) => {
      const r = await fetch(`http://localhost:${port}/api${route}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          ...headers,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      const body = await r.json();
      assert.equal(r.status, expected, JSON.stringify(body) + logs);
      return body;
    };
  }
  const admin = client(),
    other = client(),
    buyer = client(),
    anon = client();
  await admin("/auth/signup", "POST", {
    name: "Owner",
    company: "Atelier",
    email: "owner@example.com",
    password: "safepassword123",
  });
  await other("/auth/signup", "POST", {
    name: "Other",
    company: "Other",
    email: "other@example.com",
    password: "safepassword123",
  });
  await buyer("/auth/signup", "POST", {
    name: "Client",
    email: "buyer@example.com",
    password: "safepassword123",
  });
  let p = await admin("/products", "POST", { template: "cabinet" }, 201);
  await other("/products/" + p.id, "GET", undefined, 404);
  const check = await admin("/products/" + p.id + "/check-publish", "POST", {
    revision: p.revision,
    manifest: p.draft,
    mode: "quote",
  });
  assert.equal(check.ready, true);
  await other(
    "/products/" + p.id + "/check-publish",
    "POST",
    { revision: p.revision, manifest: p.draft, mode: "quote" },
    404,
  );
  const afterCheck = await admin("/products/" + p.id);
  assert.equal(afterCheck.revision, p.revision);
  assert.equal(afterCheck.active, false);

  const draftAsset = p.draft.groups[0].options[0].assets.frontal;
  await anon("/assets/" + draftAsset, "GET", undefined, 404);
  await anon("/public/" + p.id, "GET", undefined, 404);
  p = await admin("/products/" + p.id + "/publish", "POST", {
    revision: p.revision,
  });
  const pub = await anon("/public/" + p.id);
  assert.match(p.publicPath, /^\/p\/atelier\/mueble-a-medida$/);
  const named = "/catalog/" + p.publicPath.slice(3);
  assert.equal((await anon(named)).id, p.id);
  const shared = await anon("/public/" + p.id + "/share", "POST", {
    version: p.revision,
    selection: {},
  });
  assert.equal(shared.path.includes("selection="), false);
  const query = new URL(shared.path, "http://local").search;
  assert.ok((await anon(named + query)).sharedSelection);
  assert.equal(
    (
      await anon("/public/" + p.id + "/share", "POST", {
        version: p.revision,
        selection: {},
      })
    ).path,
    shared.path,
  );
  // Existing links stay usable when the storage budget prevents new shares.
  const quotaDb = new DatabaseSync(path.join(dir, "studio.sqlite"));
  quotaDb
    .prepare("INSERT INTO shared_selections VALUES(?,?,?,?,?)")
    .run(
      "quota-fixture",
      p.id,
      p.revision,
      "x".repeat(20 * 1024 * 1024),
      new Date().toISOString(),
    );
  await anon(
    "/public/" + p.id + "/share",
    "POST",
    {
      version: p.revision,
      selection: { [p.draft.groups[0].id]: p.draft.groups[0].options[1].id },
    },
    429,
  );
  assert.equal(
    (
      await anon("/public/" + p.id + "/share", "POST", {
        version: p.revision,
        selection: {},
      })
    ).path,
    shared.path,
  );
  quotaDb
    .prepare("DELETE FROM shared_selections WHERE code='quota-fixture'")
    .run();
  quotaDb.close();
  await anon(named + "?c=missing", "GET", undefined, 404);
  await anon("/catalog/not-a-store/no-product", "GET", undefined, 404);

  const c = await buyer(
    "/configurations",
    "POST",
    { productId: p.id, version: p.revision, selection: {}, amount: 1 },
    201,
  );
  assert.equal(c.amount, p.draft.basePrice);
  await other("/customer/orders", "POST", { configurationId: c.id }, 404);
  let order = await buyer(
    "/customer/orders",
    "POST",
    { configurationId: c.id },
    201,
  );
  assert.equal(order.amount, c.amount);
  assert.equal(order.status, "requested");
  await other("/orders/" + order.id, "GET", undefined, 404);
  await buyer("/orders/" + order.id + "/offer", "POST", { amount: 1 }, 403);
  order = await admin("/orders/" + order.id + "/offer", "POST", {
    amount: 55500,
    note: "Incluye entrega",
  });
  await buyer("/orders/" + order.id + "/accept", "POST", { revision: 0 }, 409);
  order = await buyer("/orders/" + order.id + "/accept", "POST", {
    revision: order.offer_revision,
  });
  assert.equal(order.status, "accepted");
  await admin(
    "/orders/" + order.id + "/status",
    "POST",
    { status: "paid" },
    409,
  );
  await buyer("/orders/" + order.id + "/checkout", "POST", {}, 503);
  await admin("/orders/" + order.id + "/offer", "POST", { amount: 1 }, 409);
  const edited = structuredClone(p.draft);
  edited.basePrice = 99900;
  const next = await admin("/products/" + p.id, "PATCH", {
    revision: p.revision,
    manifest: edited,
    mode: "quote",
  });
  await admin(
    "/products/" + p.id,
    "PATCH",
    { revision: p.revision, manifest: edited, mode: "quote" },
    409,
  );
  assert.equal(
    (await anon("/public/" + p.id)).manifest.basePrice,
    pub.manifest.basePrice,
  );
  await admin("/products/" + p.id + "/publish", "POST", {
    revision: next.revision,
  });
  assert.equal((await anon("/public/" + p.id)).publicPath, p.publicPath);
  await anon(named + query, "GET", undefined, 409);
  assert.equal(
    (await buyer("/orders/" + order.id)).configuration.manifest.basePrice,
    pub.manifest.basePrice,
  );
  await buyer(
    "/configurations",
    "POST",
    { productId: p.id, version: p.revision, selection: {} },
    409,
  );
  await buyer(
    "/configurations",
    "POST",
    {
      productId: p.id,
      version: next.revision,
      selection: { finish: "doesnotexist" },
    },
    400,
  );
  const otherProduct = await other(
    "/products",
    "POST",
    { template: "shirt" },
    201,
  );
  edited.groups[0].options[0].assets.frontal =
    otherProduct.draft.groups[0].options[0].assets.frontal;
  await admin(
    "/products/" + p.id,
    "PATCH",
    { revision: next.revision, manifest: edited, mode: "quote" },
    400,
  );
  await admin("/products", "POST", { template: "shirt" }, 403, {
    Origin: "https://evil.example",
  });
  const tok = await admin(
    "/tokens",
    "POST",
    { label: "Reader", scopes: ["read"] },
    201,
  );
  await anon("/products", "GET", undefined, 200, {
    Authorization: "Bearer " + tok.token,
  });
  await anon("/products", "POST", { template: "shirt" }, 403, {
    Authorization: "Bearer " + tok.token,
  });
  await admin("/tokens/" + tok.id, "DELETE", {});
  await anon("/products", "GET", undefined, 403, {
    Authorization: "Bearer " + tok.token,
  });
  const png = await sharp({
    create: { width: 20, height: 20, channels: 4, background: "#ff000088" },
  })
    .png()
    .toBuffer();
  const asset = await admin(
    "/assets",
    "POST",
    { name: "layer.png", data: png.toString("base64") },
    201,
  );
  assert.equal(asset.width, 20);
  assert.equal(asset.mime, "image/webp");
  await admin(
    "/assets",
    "POST",
    { name: "bad.png", data: Buffer.from("not an image").toString("base64") },
    400,
  );
  // Removing a product closes its public endpoint but must retain order history.
  await other("/products/" + p.id, "DELETE", {}, 404);
  await admin("/products/" + p.id, "DELETE", {});
  await anon("/public/" + p.id, "GET", undefined, 404);
  assert.equal(
    (await admin("/products")).some((v) => v.id === p.id),
    false,
  );
  assert.equal(
    (await admin("/trash")).some((v) => v.id === p.id),
    true,
  );
  assert.equal(
    (await other("/trash")).some((v) => v.id === p.id),
    false,
  );
  assert.equal((await buyer("/orders/" + order.id)).amount, 55500);
  await other("/products/" + p.id + "/restore", "POST", {}, 404);
  const restored = await admin("/products/" + p.id + "/restore", "POST", {});
  assert.equal(restored.active, false);
  await anon("/public/" + p.id, "GET", undefined, 404);
  assert.equal(
    (await admin("/trash")).some((v) => v.id === p.id),
    false,
  );
});
