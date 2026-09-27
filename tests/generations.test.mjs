import test from "node:test";
import { packGlb } from "./helpers/glb.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { openDB } from "../server/db.mjs";
import { generations } from "../server/generations.mjs";
test("Photo-to-3D consent, ownership, idempotency, retrieval, import and quotas", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "yenze-generation-")),
    db = openDB(dir);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const uid = () => randomBytes(16).toString("hex"),
    now = () => new Date().toISOString();
  db.prepare(
    "INSERT INTO organizations(id,slug,name,created) VALUES(?,?,?,?)",
  ).run("org", "org", "Shop", now());
  db.prepare(
    "INSERT INTO organizations(id,slug,name,created) VALUES(?,?,?,?)",
  ).run("other", "other", "Other", now());
  const storeAsset = (org, bytes, mime, name, meta) => {
    const id = uid();
    db.prepare("INSERT INTO assets VALUES(?,?,?,?,?,?,?)").run(
      id,
      org,
      name,
      mime,
      bytes,
      JSON.stringify(meta),
      now(),
    );
    return id;
  };
  const img = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "white" },
  })
    .webp()
    .toBuffer();
  const a = storeAsset("org", img, "image/webp", "photo", {}),
    foreign = storeAsset("other", img, "image/webp", "photo", {});
  let calls = 0,
    assetHost = "assets.meshy.ai";
  const glb = packGlb();
  const request = async (url, options) => {
    calls++;
    if (String(url).startsWith("https://assets.meshy.ai/")) {
      assert.equal(options.redirect, "error");
      assert.equal(options.headers, undefined);
      return new Response(glb);
    }
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.ok(body.image_urls[0].startsWith("data:image/jpeg;base64,"));
      assert.deepEqual(body.target_formats, ["glb"]);
      return Response.json({ result: "task-123" });
    }
    return Response.json({
      status: "SUCCEEDED",
      progress: 100,
      model_urls: { glb: "https://" + assetHost + "/result.glb" },
    });
  };
  const g = generations({
    db,
    uid,
    now,
    storeAsset,
    audit: () => {},
    key: "fake-key",
    allowed: ["org"],
    request,
  });
  assert.equal(g.enabled("other"), false);
  await assert.rejects(g.create("other", "u", { consent: true }), /habilitada/);
  await assert.rejects(
    g.create("org", "u", { requestKey: randomUUID(), assets: [a] }),
    /Confirma/,
  );
  await assert.rejects(
    g.create("org", "u", {
      requestKey: randomUUID(),
      assets: [foreign],
      consent: true,
    }),
    /Foto/,
  );
  assert.equal(calls, 0);
  const payload = { requestKey: randomUUID(), assets: [a], consent: true };
  const created = await g.create("org", "u", payload);
  assert.equal(created.status, "PENDING");
  assert.equal((await g.create("org", "u", payload)).id, created.id);
  assert.equal(calls, 1);
  await assert.rejects(g.get("other", created.id), /encontrada/);
  assert.equal((await g.get("org", created.id)).status, "SUCCEEDED");
  assetHost = "127.0.0.1";
  await assert.rejects(g.importModel("org", "u", created.id), /Origen/);
  assetHost = "assets.meshy.ai";
  const model = await g.importModel("org", "u", created.id);
  assert.deepEqual(model.materials, ["Finish"]);
  assert.equal((await g.importModel("org", "u", created.id)).id, model.id);
  await g.create("org", "u", { ...payload, requestKey: randomUUID() });
  await g.create("org", "u", { ...payload, requestKey: randomUUID() });
  await assert.rejects(
    g.create("org", "u", { ...payload, requestKey: randomUUID() }),
    /Límite/,
  );
});
