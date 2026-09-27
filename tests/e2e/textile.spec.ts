import sharp from "sharp";
import { test, expect } from "@playwright/test";
test("Textile design supports text, drag, back, image, undo and durable shared design", async ({
  page,
  browser,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Textile author",
      company: "Atelier test",
      email: "textile@browser.test",
      password: "test-password-123",
    },
  });
  const resp = await page.request.post("/api/products", {
    data: { template: "shirt-3d" },
  });
  expect(resp.status()).toBe(201);
  const p = await resp.json();
  const pub = await page.request.post("/api/products/" + p.id + "/publish", {
    data: { revision: p.revision },
  });
  expect(pub.status()).toBe(200);
  await page.goto(p.publicPath);
  await page.getByRole("button", { name: /Diseñar mi camiseta/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Cold Vite transforms and the GLB load take longer on shared CI runners.
  await expect(page.locator(".print-region")).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".textile-layer-list button")).toHaveCount(0);
  await page.getByRole("button", { name: /Tu idea empieza aquí/ }).click();
  await expect(
    page.getByLabel("Texto sobre la camiseta", { exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Texto sobre la camiseta", { exact: true })
    .fill("MI IDEA");
  await page
    .getByLabel("Texto sobre la camiseta", { exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Mover MI IDEA", exact: true })
    .click();
  await page
    .getByLabel("Texto sobre la camiseta", { exact: true })
    .fill("HECHO POR MÍ");
  await page
    .getByLabel("Texto sobre la camiseta", { exact: true })
    .press("Enter");
  const handle = page.getByRole("button", {
    name: "Mover HECHO POR MÍ",
    exact: true,
  });
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 35,
    box!.y + box!.height / 2 + 45,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.getByRole("button", { name: "Duplicar elemento" }).click();
  await expect(page.locator(".textile-layer-list button")).toHaveCount(2);
  await page.getByRole("button", { name: "Eliminar elemento" }).click();
  await page.getByRole("button", { name: "Deshacer diseño" }).click();
  await expect(page.locator(".textile-layer-list button")).toHaveCount(2);
  await page.getByRole("button", { name: "Rehacer diseño" }).click();
  await page.getByRole("button", { name: "Espalda", exact: true }).click();
  await page.getByRole("button", { name: "Añadir texto", exact: true }).click();
  await page.getByLabel("Tu texto", { exact: true }).fill("EDICIÓN 01");
  await page.getByLabel("Imagen para la camiseta").setInputFiles({
    name: "print.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 3000, height: 3000, channels: 4, background: "#273f52" },
    })
      .png()
      .toBuffer(),
  });
  await expect(page.locator(".textile-layer-list button")).toHaveCount(2);
  await page.screenshot({ path: "artifacts/textile-editor.png" });
  await page
    .getByRole("button", { name: "Usar este diseño", exact: true })
    .click();
  await page.getByRole("button", { name: "Compartir", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Enlace copiado");
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const other = await browser.newPage();
  await other.goto(link);
  await other.getByRole("button", { name: /Diseñar mi camiseta/ }).click();
  await expect(other.locator(".textile-layer-list")).toContainText(
    "HECHO POR MÍ",
  );
  await other.getByRole("button", { name: "Espalda", exact: true }).click();
  await expect(other.locator(".textile-layer-list")).toContainText(
    "EDICIÓN 01",
  );
  await expect(other.locator(".textile-layer-list")).toContainText("Imagen");
  await other.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      other.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await other.screenshot({
    path: "artifacts/textile-mobile.png",
    fullPage: true,
  });
  await other.close();
  const selection = await page.evaluate(
    (id) => JSON.parse(sessionStorage.getItem("selection:" + id)!),
    p.id,
  );
  const config = await (
    await page.request.post("/api/configurations", {
      data: { productId: p.id, version: p.revision, selection },
    })
  ).json();
  const order = await (
    await page.request.post("/api/customer/orders", {
      data: { configurationId: config.id },
    })
  ).json();
  await page.goto("/?page=orders");
  await page.getByRole("button", { name: /Camiseta Studio/ }).click();
  const pendingDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "PNG espalda con originales" })
    .click();
  const download = await pendingDownload;
  const metadata = await sharp((await download.path())!).metadata();
  expect(metadata.width).toBe(3366);
  expect(metadata.height).toBe(4488);
  expect(metadata.density).toBe(300);
  await page.goto("/?edit=" + p.id);
  await page.getByRole("button", { name: /Diseñar la camiseta/ }).click();
  await page.getByRole("button", { name: "Añadir texto", exact: true }).click();
  await page
    .getByLabel("Texto sobre la camiseta", { exact: true })
    .fill("ESTUDIO ORIGINAL");
  await page
    .getByLabel("Texto sobre la camiseta", { exact: true })
    .press("Enter");
  await page.getByLabel("Imagen para la camiseta").setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(page.getByRole("alert")).toContainText("PNG, JPG o WebP");
  await page
    .getByRole("button", { name: "Usar este diseño", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  await page.reload();
  await page.getByRole("button", { name: /Diseñar la camiseta/ }).click();
  await expect(page.locator(".textile-layer-list")).toContainText(
    "ESTUDIO ORIGINAL",
  );
  expect(errors).toEqual([]);
});
