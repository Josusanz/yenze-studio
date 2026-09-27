import { test } from "node:test";
import assert from "node:assert/strict";
import { industries, setupGroups } from "../core/industries.mjs";
import { validatePrint } from "../core/print-design.mjs";
import { makeTemplate } from "../server/templates.mjs";
import { evaluateProduct, validManifest } from "../server/validation.mjs";
test("All sectors create valid editable question groups, rejecting malformed and ambiguous answers", () => {
  for (const sector of industries) {
    const m = makeTemplate("guided", () => {});
    m.groups = setupGroups({
      industry: sector.id,
      name: "Producto",
      basePrice: 0,
      questions: sector.questions,
    });
    assert.equal(
      validManifest(m, () => false, { publish: true }).name,
      "Mi producto",
    );
  }
  for (const overrides of [
    { basePrice: -1 },
    { basePrice: NaN },
    { industry: "unknown" },
    { questions: [{ label: "Talla", answers: "S, s" }] },
    { questions: [] },
    { questions: [{ label: [], answers: "S" }] },
  ])
    assert.throws(() =>
      setupGroups({
        industry: "general",
        name: "Producto",
        basePrice: 0,
        questions: industries[0].questions,
        ...overrides,
      }),
    );
});
test("Personalization is preserved in price evaluation and rejects remote images and excessive documents", () => {
  const m = makeTemplate("shirt-3d", () => "asset");
  validManifest(m, () => true, { publish: true });
  const d = structuredClone(m.personalization.design);
  d.layers.push({
    id: "my_text",
    side: "front",
    type: "text",
    text: "Hola",
    color: "#23384d",
    font: "sans",
    x: 0.5,
    y: 0.4,
    width: 0.7,
    rotation: 0,
  });
  const result = evaluateProduct(m, { size: "xl", $print: d });
  assert.equal(result.total, 2900);
  assert.equal(result.selection.$print.layers[0].text, "Hola");
  assert.equal(result.selection.size, "xl");
  for (const layer of [
    { ...d.layers[0], rotation: Infinity },
    { ...d.layers[0], type: "image", src: "https://example.com/image.png" },
    {
      ...d.layers[0],
      type: "image",
      src: "data:image/svg+xml;base64,PHN2Zz4=",
    },
    { ...d.layers[0], text: "x".repeat(101) },
  ])
    assert.throws(() => validatePrint({ version: 1, layers: [layer] }));
  assert.throws(() =>
    validatePrint({ version: 1, layers: [d.layers[0], d.layers[0]] }),
  );
  assert.throws(() =>
    validatePrint({ version: 1, layers: Array(21).fill(d.layers[0]) }),
  );
});

test("Versioned shirt templates use the detailed model while old snapshots still validate", () => {
  const m = makeTemplate("shirt-3d", () => "asset");
  assert.equal(m.personalization.model, "atelier-shirt-v2");
  assert.equal(m.groups[0].material, "Cotton");
  validManifest(m, () => true, { publish: true });
  m.personalization.model = "studio-shirt-v1";
  m.groups[0].material = "rust";
  validManifest(m, () => true, { publish: true });
});

test("Clean start removes only retired starter text, preserving edited text and legacy snapshots", () => {
  const m = makeTemplate("shirt-3d", () => "asset");
  assert.deepEqual(m.personalization.design.layers, []);
  const starter = {
    id: "studio_text",
    side: "front",
    type: "text",
    text: "GROW\nYOUR WAY.",
    color: "#23384d",
    font: "sans",
    x: 0.5,
    y: 0.4,
    width: 0.7,
    rotation: 0,
  };
  const selection = {
    $print: {
      version: 1,
      layers: [starter, { ...starter, id: "custom", text: "Mi marca" }],
    },
  };
  assert.deepEqual(
    evaluateProduct(m, selection).selection.$print.layers.map((l) => l.text),
    ["Mi marca"],
  );
  selection.$print.layers[0].text = "Mi propio texto";
  assert.equal(evaluateProduct(m, selection).selection.$print.layers.length, 2);
  m.personalization.cleanStart = false;
  selection.$print.layers[0].text = "GROW\nYOUR WAY.";
  assert.equal(evaluateProduct(m, selection).selection.$print.layers.length, 2);
});
