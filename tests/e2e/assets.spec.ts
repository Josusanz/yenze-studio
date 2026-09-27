import { test, expect } from "@playwright/test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
function glb() {
  const coords = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
    bin = Buffer.from(coords.buffer);
  const doc = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      {
        name: "Acabado",
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [0.3, 0.5, 0.8, 1],
          metallicFactor: 0,
          roughnessFactor: 0.6,
        },
      },
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-1, -1, 0],
        max: [1, 1, 0],
      },
    ],
  };
  const raw = Buffer.from(JSON.stringify(doc)),
    json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(json);
  const output = Buffer.alloc(12 + 8 + json.length + 8 + bin.length);
  output.write("glTF");
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length, 12);
  output.write("JSON", 16);
  json.copy(output, 20);
  output.writeUInt32LE(bin.length, 20 + json.length);
  output.writeUInt32LE(0x004e4942, 24 + json.length);
  bin.copy(output, 28 + json.length);
  return output;
}
test("Folder import uploads real layers; a GLB renders and publishes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const dir = mkdtempSync(join(tmpdir(), "yenze-layers-"));
  try {
    await page.request.post("/api/auth/signup", {
      data: {
        name: "Maker",
        company: "Maker Studio",
        email: "maker@assets.test",
        password: "test-password-123",
      },
    });
    const p = await (
      await page.request.post("/api/products", { data: { template: "empty" } })
    ).json();
    await page.goto("/?edit=" + p.id);
    for (const color of ["blue", "red"]) {
      const target = join(dir, "01_color", color);
      mkdirSync(target, { recursive: true });
      writeFileSync(
        join(target, "frontal.png"),
        await sharp({
          create: { width: 500, height: 500, channels: 4, background: color },
        })
          .png()
          .toBuffer(),
      );
    }
    await page.getByText("Ya tengo una carpeta organizada").click();
    await page.locator("input[webkitdirectory]").setInputFiles(dir);
    await expect(page.getByRole("status")).toContainText("Capas importadas");
    await page.getByRole("button", { name: /Elecciones/ }).click();
    await page.getByRole("button", { name: /Color.*2/ }).click();
    await expect(page.getByLabel("Nombre del grupo")).toHaveValue("Color");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Ver publicado" }),
    ).toBeVisible();
    const model = await (
      await page.request.post("/api/products", { data: { template: "model" } })
    ).json();
    await page.goto("/?edit=" + model.id);
    await page.locator('input[accept=".glb"]').setInputFiles({
      name: "triangle.glb",
      mimeType: "model/gltf-binary",
      buffer: glb(),
    });
    await expect(
      page.getByText("Modelo reconocido", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Editar colores/ }).click();
    await expect(page.locator(".model-preview canvas")).toBeVisible();
    await expect(page.getByLabel("Nombre del grupo")).toHaveValue("Acabado");
    await page.getByRole("button", { name: "Añadir color" }).click();
    await page.getByLabel("Nombre de opción").nth(1).fill("Rojo");
    await page.getByRole("button", { name: "Vista previa Rojo" }).click();
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Ver publicado" }),
    ).toBeVisible();
    await page.screenshot({ path: "artifacts/model-3d.png", fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
