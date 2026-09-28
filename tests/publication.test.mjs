import test from "node:test";
import assert from "node:assert/strict";
import { publicationCheck } from "../server/publication.mjs";
import { makeTemplate } from "../server/templates.mjs";
import {
  readRecovery,
  writeRecovery,
  recoveryKey,
} from "../core/editor-recovery.mjs";
const report = (manifest, mode = "quote", status = false) =>
  publicationCheck({
    manifest,
    mode,
    assetCheck: () => true,
    checkPrint: () => {},
    paymentStatus: async () => ({ chargesEnabled: status }),
  });
test("Publication checks block missing geometry and payments, while embeds remain optional", async () => {
  assert.equal(
    (await report({ personalization: { design: { layers: {} } } })).ready,
    false,
  );
  const empty = await makeTemplate("scene", () => {});
  assert.equal((await report(empty)).ready, false);
  const shirt = await makeTemplate("shirt-3d", () => "asset");
  assert.equal((await report(shirt)).ready, true);
  assert.equal((await report(shirt, "purchase")).ready, false);
  assert.equal((await report(shirt, "purchase", true)).ready, true);
  assert.equal(
    (await report(shirt)).checks.find((c) => c.id === "embed").state,
    "optional",
  );
});
test("Draft recovery is scoped to an authorized product and preserves revision for conflict checks", () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k),
    setItem: (k, v) => values.set(k, v),
  };
  const p = { id: "product", org_id: "workspace", revision: 3, mode: "quote" };
  const manifest = { schemaVersion: 1, name: "My pending change", groups: [] };
  writeRecovery(storage, p, manifest);
  assert.equal(readRecovery(storage, p).revision, 3);
  assert.deepEqual(readRecovery(storage, p).manifest, manifest);
  assert.equal(readRecovery(storage, { ...p, org_id: "other" }), null);
  storage.setItem(recoveryKey(p), "{broken");
  assert.equal(readRecovery(storage, p), null);
  storage.setItem(
    recoveryKey(p),
    JSON.stringify({ productId: "wrong", orgId: p.org_id, manifest }),
  );
  assert.equal(readRecovery(storage, p), null);
});
