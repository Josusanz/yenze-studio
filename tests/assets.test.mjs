import test from "node:test";
import assert from "node:assert/strict";
import { parseAsset } from "../server/assets.mjs";
import { packGlb as pack, glbDocument } from "./helpers/glb.mjs";
const sample = () => ({
  ...glbDocument(),
  meshes: [
    {
      primitives: [
        { attributes: { POSITION: 0 }, material: 0 },
        { attributes: { POSITION: 0 }, material: 1 },
      ],
    },
  ],
  materials: [
    {},
    {
      name: "Wood",
      pbrMetallicRoughness: { baseColorFactor: [0.5, 0.5, 0.5, 1] },
    },
    { name: "Unused variant" },
  ],
  nodes: [{ mesh: 0 }, { mesh: 0, name: "Pieza 1" }],
  scenes: [{ nodes: [0, 1] }],
  extensionsUsed: ["KHR_texture_transform"],
  extensionsRequired: ["KHR_texture_transform"],
});
test("GLB import recognizes supported texture transforms and gives unnamed/duplicate parts usable names", async () => {
  const a = await parseAsset(pack(sample()), "chair.glb");
  assert.deepEqual(a.meta.materials, ["Material 1", "Wood"]);
  assert.deepEqual(
    a.meta.nodes.map((n) => n.name),
    ["Pieza_1", "Pieza_1_1"],
  );
  assert.equal(a.meta.colors.Wood, "#bcbcbc");
  const doc = JSON.parse(
    a.bytes.toString("utf8", 20, 20 + a.bytes.readUInt32LE(12)),
  );
  assert.equal(doc.nodes[1].name, "Pieza_1_1");
  assert.equal(a.bytes.readUInt32LE(8), a.bytes.length);
});
test("External resources and unsupported required GLB decoders fail before assets are stored", async () => {
  let d = sample();
  d.images = [{ uri: "https://example.com/private-texture.png" }];
  await assert.rejects(parseAsset(pack(d), "bad.glb"), /autocontenido/);
  d = sample();
  d.extensionsRequired = ["KHR_draco_mesh_compression"];
  await assert.rejects(parseAsset(pack(d), "draco.glb"), /Draco/);
  await assert.rejects(
    parseAsset(Buffer.from("not a model"), "bad.glb"),
    /no válido/,
  );
});

test("Broken geometry is rejected even when GLB headers and material metadata are plausible", async () => {
  const d = sample();
  d.meshes[0].primitives[0].attributes.POSITION = 999;
  await assert.rejects(
    parseAsset(pack(d), "broken.glb"),
    /referencias no válidas/,
  );
});
