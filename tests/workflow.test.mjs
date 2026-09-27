import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { printQuality } from "../core/print-quality.mjs";
import { prunePrintAssets } from "../scripts/prune-print-assets.mjs";
import { validManifest } from "../server/validation.mjs";
test("Originals, proof approval, production locks and server-priced cart tickets", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "yenze-workflow-"));
  const port = 31786;
  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      APP_ORIGIN: `http://localhost:${port}`,
      YENZE_DATA_DIR: dir,
      STRIPE_SECRET_KEY: "",
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
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw Error(logs);
  }
  function client() {
    let cookie = "";
    return async (route, method = "GET", data, status = 200, headers = {}) => {
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
      const b = await r.json();
      assert.equal(r.status, status, JSON.stringify(b));
      return b;
    };
  }
  const owner = client(),
    other = client(),
    buyer = client(),
    anon = client();
  for (const [c, email, company] of [
    [owner, "owner", "Atelier"],
    [other, "other", "Other"],
    [buyer, "buyer", undefined],
  ])
    await c("/auth/signup", "POST", {
      name: email,
      email: email + "@example.test",
      company,
      password: "password-example-123",
    });
  let p = await owner("/products", "POST", { template: "shirt-3d" }, 201);
  const wrong = await other("/products", "POST", { template: "shirt-3d" }, 201);
  await owner("/products/" + p.id + "/publish", "POST", {
    revision: p.revision,
  });
  const bytes = await sharp({
    create: { width: 3000, height: 3600, channels: 4, background: "#253951" },
  })
    .png()
    .toBuffer();
  const original = await anon(
    `/public/${p.id}/print-assets`,
    "POST",
    { data: bytes.toString("base64"), name: "original.png" },
    201,
  );
  assert.equal(original.original.width, 3000);
  assert.deepEqual(
    (
      await anon(
        `/public/${p.id}/print-assets`,
        "POST",
        { data: bytes.toString("base64") },
        201,
      )
    ).original,
    original.original,
  );
  await other(
    `/products/${p.id}/print-assets`,
    "POST",
    { data: bytes.toString("base64") },
    404,
  );
  await anon(
    `/public/${p.id}/print-assets`,
    "POST",
    { data: Buffer.from("<svg/>").toString("base64") },
    400,
  );
  const src =
    "data:image/png;base64," +
    (await sharp(bytes).resize(300).png().toBuffer()).toString("base64");
  const design = {
    version: 1,
    layers: [
      {
        id: "art",
        type: "image",
        side: "front",
        x: 0.5,
        y: 0.5,
        width: 0.5,
        rotation: 0,
        src,
        original: original.original,
      },
    ],
  };
  assert.equal(printQuality(design, p.draft.personalization).issues.length, 0);
  assert.ok(
    printQuality(
      { ...design, layers: [{ ...design.layers[0], original: undefined }] },
      p.draft.personalization,
    ).issues.some((i) => i.code === "resolution"),
  );
  let manifest = {
    ...p.draft,
    personalization: { ...p.draft.personalization, design },
  };
  await other(
    "/products/" + wrong.id,
    "PATCH",
    { revision: wrong.revision, mode: "quote", manifest },
    400,
  );
  await owner(
    "/products/" + p.id,
    "PATCH",
    {
      revision: p.revision,
      mode: "quote",
      manifest: { ...manifest, personalization: null },
    },
    400,
  );
  p = await owner("/products/" + p.id, "PATCH", {
    revision: p.revision,
    mode: "quote",
    manifest,
  });
  const copy = await owner("/products/" + p.id + "/duplicate", "POST", {}, 201);
  assert.notEqual(
    copy.draft.personalization.design.layers[0].original.ref,
    original.original.ref,
  );
  await owner("/products/" + copy.id, "PATCH", {
    revision: copy.revision,
    mode: "quote",
    manifest: copy.draft,
  });
  await owner("/products/" + p.id + "/publish", "POST", {
    revision: p.revision,
  });
  const forged = {
    ...design,
    layers: [
      { ...design.layers[0], original: { ...original.original, width: 5000 } },
    ],
  };
  await buyer(
    "/configurations",
    "POST",
    { productId: p.id, version: p.revision, selection: { $print: forged } },
    400,
  );
  const c = await buyer(
    "/configurations",
    "POST",
    { productId: p.id, version: p.revision, selection: { $print: design } },
    201,
  );
  const o = await buyer(
    "/customer/orders",
    "POST",
    { configurationId: c.id },
    201,
  );
  await other("/orders/" + o.id + "/production-file", "GET", undefined, 404);
  await anon("/orders/" + o.id + "/production-file", "GET", undefined, 401);
  assert.deepEqual(
    (await buyer("/orders/" + o.id + "/production-file")).originals,
    [],
  );
  const packet = await owner("/orders/" + o.id + "/production-file");
  assert.equal(
    Buffer.from(packet.originals[0].base64, "base64").compare(bytes),
    0,
  );
  assert.equal(packet.quality.widthPx, 3366);
  await buyer("/orders/" + o.id + "/proof", "POST", { note: "no" }, 403);
  const proof = await owner("/orders/" + o.id + "/proof", "POST", {
    note: "Revisa frontal, talla y medidas.",
  });
  await owner(
    "/orders/" + o.id + "/approve-proof",
    "POST",
    { revision: 1, digest: proof.proof.digest, confirmed: true },
    403,
  );
  await buyer(
    "/orders/" + o.id + "/approve-proof",
    "POST",
    { revision: 0, digest: proof.proof.digest, confirmed: true },
    409,
  );
  await buyer("/orders/" + o.id + "/approve-proof", "POST", {
    revision: 1,
    digest: proof.proof.digest,
    confirmed: true,
  });
  assert.ok((await buyer("/orders/" + o.id)).proof.approved_at);
  const again = await owner("/orders/" + o.id + "/proof", "POST", {
    note: "Revisión final.",
  });
  assert.equal(again.proof.approved_at, null);
  // Payment itself is covered by the signed Stripe webhook tests; simulate only the persisted paid state here.
  const db = new DatabaseSync(join(dir, "studio.sqlite"));
  db.prepare("UPDATE orders SET status='paid' WHERE id=?").run(o.id);
  await owner(
    "/orders/" + o.id + "/status",
    "POST",
    { status: "production" },
    409,
  );
  await buyer("/orders/" + o.id + "/approve-proof", "POST", {
    revision: 2,
    digest: again.proof.digest,
    confirmed: true,
  });
  await owner("/orders/" + o.id + "/status", "POST", { status: "production" });
  const ticket = await anon(
    `/public/${p.id}/cart-ticket`,
    "POST",
    { version: p.revision, selection: { $print: design }, amount: 1 },
    201,
  );
  const resolved = await owner("/commerce/resolve", "POST", {
    ticket: ticket.ticket,
  });
  assert.equal(resolved.amount, 2900);
  await other("/commerce/resolve", "POST", { ticket: ticket.ticket }, 404);
  await anon("/commerce/resolve", "POST", { ticket: ticket.ticket }, 401);
  db.prepare("UPDATE commerce_tickets SET expires=0 WHERE id=?").run(
    ticket.ticket,
  );
  await owner("/commerce/resolve", "POST", { ticket: ticket.ticket }, 404);
  const fresh = await anon(
    `/public/${p.id}/cart-ticket`,
    "POST",
    { version: p.revision, selection: {} },
    201,
  );
  p = await owner("/products/" + p.id, "PATCH", {
    revision: p.revision,
    manifest: { ...p.draft, basePrice: 4500 },
    mode: "quote",
  });
  await owner("/products/" + p.id + "/publish", "POST", {
    revision: p.revision,
  });
  await owner("/commerce/resolve", "POST", { ticket: fresh.ticket }, 409);
  await owner(
    "/workspace",
    "PATCH",
    { name: "evil", accent: "#111111", domains: [] },
    403,
    { Origin: "https://evil.example" },
  );
  assert.equal(
    (await owner("/readiness")).checks.find((c) => c.id === "payments").state,
    "pending",
  );
  const abandoned = await anon(
    `/public/${p.id}/print-assets`,
    "POST",
    {
      data: (
        await sharp({
          create: { width: 80, height: 80, channels: 4, background: "#ff1122" },
        })
          .png()
          .toBuffer()
      ).toString("base64"),
    },
    201,
  );
  db.prepare(
    "UPDATE print_assets SET created='2020-01-01T00:00:00.000Z'",
  ).run();
  const candidates = prunePrintAssets(db);
  assert.equal(candidates.count, 1);
  assert.equal(candidates.apply, false);
  assert.ok(
    db
      .prepare("SELECT ref FROM print_assets WHERE ref=?")
      .get(abandoned.original.ref),
  );
  assert.equal(prunePrintAssets(db, { apply: true }).count, 1);
  assert.ok(
    db
      .prepare("SELECT ref FROM print_assets WHERE ref=?")
      .get(original.original.ref),
  );
  assert.equal(
    db
      .prepare("SELECT ref FROM print_assets WHERE ref=?")
      .get(abandoned.original.ref),
    undefined,
  );
  db.close();
});

test("PNG production exports retain pixels and carry the requested print density", async () => {
  const { pngResolution } = await import("../core/png-resolution.mjs");
  const source = await sharp({
    create: { width: 100, height: 150, channels: 4, background: "#ab22ff" },
  })
    .png()
    .toBuffer();
  const output = pngResolution(source, 300);
  const meta = await sharp(output).metadata();
  assert.equal(meta.width, 100);
  assert.equal(meta.height, 150);
  assert.equal(meta.density, 300);
  assert.deepEqual(
    await sharp(source).raw().toBuffer(),
    await sharp(output).raw().toBuffer(),
  );
  assert.equal(
    (await sharp(pngResolution(output, 150)).metadata()).density,
    150,
  );
  assert.throws(() => pngResolution(source.slice(0, 36), 300));
});
