import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, hierarchy } from "../core/layers.mjs";
import { validManifest } from "../server/validation.mjs";
const group = (id, options, parent = null) => ({
  id,
  label: id,
  order: { material: 0, wood: 1, finish: 2, extra: 3 }[id] || 0,
  required: true,
  effect: "choice",
  default: options[0].id,
  options,
  parent,
});
const m = {
  schemaVersion: 1,
  kind: "form",
  name: "Mi producto",
  currency: "EUR",
  basePrice: 10000,
  canvas: { width: 1000, height: 850 },
  views: ["frontal"],
  rules: [],
  groups: [
    group("material", [
      { id: "wood", label: "Madera", priceDelta: 0 },
      { id: "metal", label: "Metal", priceDelta: 2000 },
    ]),
    group(
      "wood",
      [
        { id: "oak", label: "Roble", priceDelta: 1000 },
        { id: "walnut", label: "Nogal", priceDelta: 2500 },
      ],
      { group: "material", option: "wood" },
    ),
    group(
      "finish",
      [
        { id: "natural", label: "Natural", priceDelta: 0 },
        { id: "lacquer", label: "Lacado", priceDelta: 500 },
      ],
      { group: "wood", option: "oak" },
    ),
  ],
};
test("Parent, child and grandchild normalize hidden selections and prices", () => {
  const a = evaluate(m, { material: "wood", wood: "oak", finish: "lacquer" });
  assert.equal(a.total, 11500);
  assert.deepEqual(a.visibleGroups, ["material", "wood", "finish"]);
  const b = evaluate(m, {
    material: "metal",
    wood: "walnut",
    finish: "lacquer",
  });
  assert.equal(b.total, 12000);
  assert.deepEqual(b.selection, { material: "metal" });
  assert.deepEqual(b.visibleGroups, ["material"]);
  const c = evaluate(m, {
    material: "wood",
    wood: "walnut",
    finish: "invalid-hidden",
  });
  assert.equal(c.valid, true);
  assert.equal(c.total, 12500);
  assert.deepEqual(c.selection, { material: "wood", wood: "walnut" });
  assert.equal(evaluate(m, { extra: "injected" }).valid, false);
});
test("Hierarchy is independent of ordering and rejects cycles, missing parents and excessive nesting", () => {
  assert.equal(
    evaluate({ ...m, groups: [...m.groups].reverse() }).total,
    11000,
  );
  let bad = structuredClone(m);
  bad.groups[0].parent = { group: "finish", option: "natural" };
  assert.throws(() => hierarchy(bad.groups), /descendientes/);
  bad = structuredClone(m);
  bad.groups[1].parent.option = "missing";
  assert.throws(() => validManifest(bad, () => true), /padre/);
  const deep = Array.from({ length: 14 }, (_, i) =>
    group(
      "g" + i,
      [{ id: "yes", label: "Yes", priceDelta: 0 }],
      i ? { group: "g" + (i - 1), option: "yes" } : null,
    ),
  );
  assert.throws(() => hierarchy(deep), /12 niveles/);
});
test("Rules apply only to active branches and missing required images prevent publication", () => {
  const rules = [
    {
      type: "requires",
      when: { group: "finish", option: "lacquer" },
      target: { group: "material", option: "wood" },
      message: "Usa madera",
    },
  ];
  assert.equal(
    evaluate({ ...m, rules }, { material: "metal", finish: "lacquer" }).valid,
    true,
  );
  const image = { ...structuredClone(m), kind: "images-2d" };
  image.groups[0].effect = "image";
  assert.doesNotThrow(() => validManifest(image, () => true));
  assert.throws(
    () => validManifest(image, () => true, { publish: true }),
    /Falta imagen/,
  );
  assert.doesNotThrow(() => validManifest(m, () => true, { publish: true }));
});
