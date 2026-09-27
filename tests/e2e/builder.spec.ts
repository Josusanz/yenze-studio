import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("A first-time seller with no images creates, tests, publishes, deletes and restores a configurator", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Principiante",
      company: "Mi taller",
      email: "novice@builder.test",
      password: "test-password-123",
    },
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Crear configurador", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("¿Qué vas a vender?").fill("Mi mesa a medida");
  await page
    .getByRole("button", { name: "Muebles y espacios", exact: true })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Pregunta 1", { exact: true }).fill("Material");
  await page.getByLabel("Respuestas 1").fill("Madera, Metal");
  await page.getByLabel("Precio desde (€)").fill("200");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Aún no tengo imágenes/ }),
  ).toHaveClass(/active/);
  await page.screenshot({
    path: "artifacts/start-no-images.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Crear mi configurador" }).click();
  await expect(page.getByLabel("Nombre del producto")).toHaveValue(
    "Mi mesa a medida",
  );
  await expect(page.locator(".canvas .summary-stage")).toContainText("Madera");
  await expect(page.locator(".tree-row")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Añadir subopción a «Madera»", exact: true })
    .click();
  await page.getByLabel("Nombre del grupo").fill("Tipo de madera");
  await page.getByLabel("Nombre de opción").fill("Roble");
  await page.getByLabel("Suplemento Roble").fill("25");
  await page
    .getByRole("button", { name: "Añadir subopción a «Roble»", exact: true })
    .click();
  await page.getByLabel("Nombre del grupo").fill("Tratamiento");
  await page.getByLabel("Nombre de opción").fill("Aceitado");
  await page.getByLabel("Suplemento Aceitado").fill("10");
  await page.getByRole("button", { name: "Probar", exact: true }).click();
  await expect(page.locator(".test-panel")).toContainText("Tipo de madera");
  await expect(page.locator(".test-panel")).toContainText("Tratamiento");
  await expect(page.locator(".canvas-bottom")).toContainText("235");
  await page
    .locator(".test-panel")
    .getByRole("button", { name: /Metal/ })
    .click();
  await expect(page.locator(".test-panel")).not.toContainText("Tipo de madera");
  await expect(page.locator(".test-panel")).not.toContainText("Tratamiento");
  await expect(page.locator(".canvas-bottom")).toContainText("200");
  await page.screenshot({
    path: "artifacts/builder-test-branches.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ver publicado" })).toBeVisible();
  const href = (await page
    .getByRole("link", { name: "Ver publicado" })
    .getAttribute("href"))!;
  const id = new URL(page.url()).searchParams.get("edit");
  const buyer = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await buyer.goto("http://127.0.0.1:3070" + href);
  await expect(
    buyer.getByRole("heading", { name: "Mi mesa a medida" }).first(),
  ).toBeVisible();
  expect(
    await buyer.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await buyer.screenshot({
    path: "artifacts/no-images-mobile.png",
    fullPage: true,
  });
  await page.goto("/?page=products");
  await page.getByRole("button", { name: "Eliminar Mi mesa a medida" }).click();
  await page.getByRole("button", { name: "Conservar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mi mesa a medida", level: 3 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Eliminar Mi mesa a medida" }).click();
  await page
    .getByRole("button", { name: "Eliminar configurador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mi mesa a medida", level: 3 }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/public/" + id)).status()).toBe(404);
  await page.getByRole("button", { name: "Papelera", exact: true }).click();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mi mesa a medida", level: 3 }),
  ).toBeVisible();
  expect((await page.request.get("/api/public/" + id)).status()).toBe(404);
  expect(errors).toEqual([]);
  await buyer.close();
});
test("Image-only creation accepts different photo sizes and thumbnails never overflow the test panel", async ({
  page,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Fotos",
      company: "Foto estudio",
      email: "photos@builder.test",
      password: "test-password-123",
    },
  });
  const p = await (
    await page.request.post("/api/products", { data: { template: "images" } })
  ).json();
  await page.goto("/?edit=" + p.id);
  const blue = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: "#325875" },
    })
      .png()
      .toBuffer(),
    red = await sharp({
      create: { width: 800, height: 1200, channels: 3, background: "#9d6356" },
    })
      .png()
      .toBuffer();
  await page.getByLabel("Subir imágenes del producto").setInputFiles([
    { name: "azul.png", mimeType: "image/png", buffer: blue },
    { name: "terracota.png", mimeType: "image/png", buffer: red },
  ]);
  await expect(page.getByLabel("Nombre del grupo")).toHaveValue(
    "Elige tu versión",
  );
  await page.getByRole("button", { name: "Probar", exact: true }).click();
  await expect(page.locator(".test-panel .choice-thumb")).toHaveCount(2);
  for (const image of await page.locator(".test-panel .choice-thumb").all()) {
    const b = await image.boundingBox();
    expect(b!.width).toBeLessThanOrEqual(44);
    expect(b!.height).toBeLessThanOrEqual(38);
  }
  const panel = await page.locator(".inspector").boundingBox();
  const button = await page
    .locator(".test-panel .choices button")
    .first()
    .boundingBox();
  expect(button!.width).toBeLessThan(panel!.width);
  await page.screenshot({
    path: "artifacts/image-builder-preview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ver publicado" })).toBeVisible();
});
test("Create a 3D scene from scratch, change dimensions, undo and publish", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/auth/signup", {
    data: {
      name: "3D",
      company: "Scene studio",
      email: "scene@builder.test",
      password: "test-password-123",
    },
  });
  const p = await (
    await page.request.post("/api/products", { data: { template: "scene" } })
  ).json();
  await page.goto("/?edit=" + p.id);
  await page
    .getByRole("button", { name: /Empezar con una mesa editable/ })
    .click();
  await expect(page.locator(".piece-list button")).toHaveCount(5);
  await page.getByRole("button", { name: "Tablero", exact: true }).click();
  await page.getByLabel("Medidas (metros) X", { exact: true }).fill("2.5");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(
    page.getByLabel("Medidas (metros) X", { exact: true }),
  ).not.toHaveValue("2.5");
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(
    page.getByLabel("Medidas (metros) X", { exact: true }),
  ).toHaveValue("2.5");
  await page.getByLabel("Nombre de la pieza").fill("Tablero largo");
  await page.getByRole("button", { name: "Permitir elegir su color" }).click();
  await page.getByLabel("Nombre del grupo").fill("Color del tablero");
  await page.getByRole("button", { name: "Añadir color", exact: true }).click();
  await page.getByLabel("Nombre de opción").nth(1).fill("Azul");
  await page.getByLabel("Color de opción").nth(1).fill("#335577");
  await page.getByRole("button", { name: "Vista previa Azul" }).click();
  await page.getByRole("button", { name: "Probar", exact: true }).click();
  await expect(page.locator(".model-preview canvas")).toBeVisible();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ver publicado" })).toBeVisible();
  await page.screenshot({
    path: "artifacts/scene-builder.png",
    fullPage: true,
  });
  const stored = await (await page.request.get("/api/products/" + p.id)).json();
  expect(stored.draft.objects[0].size[0]).toBe(2.5);
  expect(stored.draft.objects).toHaveLength(5);
  expect(errors).toEqual([]);
});

test("Typing during a slow save preserves newer edits and can be saved afterward", async ({
  page,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Concurrent author",
      company: "Slow network",
      email: "slow@builder.test",
      password: "test-password-123",
    },
  });
  const p = await (
    await page.request.post("/api/products", { data: { template: "guided" } })
  ).json();
  await page.goto("/?edit=" + p.id);
  await page.getByLabel("Nombre del producto").fill("Primera edición");
  let release!: () => void;
  const waiting = new Promise<void>((r) => (release = r));
  let entered!: () => void;
  const intercepted = new Promise<void>((r) => (entered = r));
  await page.route("**/api/products/" + p.id, async (route) => {
    if (route.request().method() === "PATCH") {
      entered();
      await waiting;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await intercepted;
  await page
    .getByLabel("Nombre del producto")
    .fill("Edición durante el guardado");
  release();
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  await expect(page.getByLabel("Nombre del producto")).toHaveValue(
    "Edición durante el guardado",
  );
  await expect(
    page.getByText("Cambios sin guardar", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/products/" + p.id);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText(/Borrador guardado · versión/)).toBeVisible();
  const stored = await (await page.request.get("/api/products/" + p.id)).json();
  expect(stored.draft.name).toBe("Edición durante el guardado");
});
