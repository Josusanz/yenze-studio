import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planLayers, evaluate } from "../core/layers.mjs";
import { importFolder } from "../core/import-folder.mjs";
const files = [
  "02_tirador/laton/frontal.png",
  "01_puerta/roble/frontal.png",
  "01_puerta/blanco/frontal.png",
].map((path) => ({ path, width: 1200, height: 1200 }));
test("el orden de lectura no cambia el manifiesto; capas ordenadas y precios en céntimos", () => {
  const m = planLayers(files, { basePrice: 10000 });
  assert.deepEqual(m, planLayers([...files].reverse(), { basePrice: 10000 }));
  m.groups[1].options[0].priceDelta = 2500;
  assert.equal(evaluate(m).total, 12500);
  assert.deepEqual(
    evaluate(m).layers.map((l) => l.group),
    ["puerta", "tirador"],
  );
});
test("rechaza carpetas ambiguas, rutas externas, tamaños y vistas incompletas", () => {
  for (const path of [
    "../roble/frontal.png",
    "/01_puerta/roble/frontal.png",
    "01_puerta/roble/../../a.png",
  ])
    assert.throws(() => planLayers([{ path, width: 10, height: 10 }]));
  assert.throws(() => planLayers([...files, { ...files[0] }]));
  assert.throws(() =>
    planLayers([
      ...files,
      { ...files[0], path: "03_extra/a/frontal.png", width: 20 },
    ]),
  );
  assert.throws(() =>
    planLayers([
      ...files,
      { ...files[0], path: "02_tirador/laton/lateral.png" },
    ]),
  );
});
test("las reglas bloquean el precio de combinaciones incompatibles y entradas desconocidas", () => {
  const m = planLayers(files);
  m.rules = [
    {
      type: "requires",
      when: { group: "tirador", option: "laton" },
      target: { group: "puerta", option: "roble" },
    },
  ];
  assert.equal(evaluate(m).total, null);
  assert.equal(evaluate(m, { puerta: "roble" }).valid, true);
  assert.equal(evaluate(m, { precio: 1 }).valid, false);
  assert.equal(evaluate(m, { puerta: "inventado" }).valid, false);
  m.rules[0].type = "excludes";
  assert.equal(evaluate(m, { puerta: "roble" }).valid, false);
});
test("opciones prescindibles y suplementos negativos o decimales", () => {
  const m = planLayers(files);
  m.groups[1].required = false;
  assert.equal(evaluate(m, { tirador: null }).layers.length, 1);
  for (const price of [-1, 1.5, NaN]) {
    m.groups[0].options[0].priceDelta = price;
    assert.throws(() => evaluate(m));
  }
});
test("importa una carpeta PNG real y rechaza enlaces simbólicos", async () => {
  const root = await mkdtemp(join(tmpdir(), "yenze-layers-"));
  try {
    await mkdir(join(root, "01_base", "claro"), { recursive: true });
    // Valid 1x1 PNG fixture; importer inspects metadata, not image appearance.
    await writeFile(
      join(root, "01_base", "claro", "frontal.png"),
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const m = await importFolder(root);
    assert.equal(m.canvas.width, 1);
    assert.equal(m.groups[0].id, "base");
    await symlink(join(root, "01_base"), join(root, "linked"));
    await assert.rejects(importFolder(root), /simbólicos/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
