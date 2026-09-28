import { test, expect } from "@playwright/test";
async function editor(page: any, email: string, template = "guided") {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Novice",
      company: "Simple studio",
      email,
      password: "test-password-123",
    },
  });
  const p = await (
    await page.request.post("/api/products", { data: { template } })
  ).json();
  await page.goto("/?edit=" + p.id);
  await expect(page.getByLabel("Nombre del producto")).toBeVisible();
  return p;
}
test("A beginner builds a choice, catches a duplicate, previews the price and continues to publication", async ({
  page,
}) => {
  const p = await editor(page, "guide@choices.test");
  await page
    .getByRole("button", { name: "Añadir elección", exact: true })
    .click();
  const composer = page.getByRole("region", {
    name: "Crear una elección paso a paso",
  });
  await composer.getByRole("button", { name: /Otra elección/ }).click();
  await page.getByLabel("Nombre de la nueva elección").fill("Tu experiencia");
  await page.getByLabel("Nombre de respuesta 1").fill("Esencial");
  await page.getByLabel("Nombre de respuesta 2").fill("esencial");
  await composer.getByRole("button", { name: "Añadir a mi producto" }).click();
  await expect(composer.getByRole("alert")).toContainText("nombres distintos");
  expect(
    (await (await page.request.get("/api/products/" + p.id)).json()).draft
      .groups,
  ).toHaveLength(0);
  await page.getByLabel("Nombre de respuesta 2").fill("Completa");
  await page.getByLabel("Extra de respuesta 2").fill("35");
  await composer
    .getByLabel("Vista previa de la nueva elección")
    .getByRole("button", { name: /Completa/ })
    .click();
  await expect(
    composer.getByLabel("Vista previa de la nueva elección"),
  ).toContainText("35,00");
  await page.setViewportSize({ width: 390, height: 844 });
  await composer
    .getByRole("button", { name: "Añadir a mi producto" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/choice-guide-mobile.png",
    fullPage: true,
  });
  await composer.getByRole("button", { name: "Añadir a mi producto" }).click();
  await expect(composer).toHaveCount(0);
  await page
    .getByRole("button", { name: "Probar como cliente", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Vista previa de cliente" });
  await preview.getByRole("button", { name: /Completa/ }).click();
  await expect(preview.locator(".buyer-total")).toContainText("35,00");
  await preview
    .getByRole("button", { name: "Continuar a publicación" })
    .click();
  await expect(page.getByLabel("Comprobación de publicación")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publicar mi configurador", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Ready choices can be cancelled and a confirmed 3D color choice is undone as one change", async ({
  page,
}) => {
  const p = await editor(page, "material@choices.test", "table-3d");
  const count = p.draft.groups.length;
  await page
    .getByRole("button", { name: "Añadir elección", exact: true })
    .click();
  await page.getByRole("button", { name: /Tallas o tamaños/ }).click();
  await expect(page.getByLabel("Nombre de la nueva elección")).toBeFocused();
  await page
    .getByLabel("Nombre de la nueva elección")
    .fill("Medida de mi producto");
  await page.getByRole("button", { name: "Cambiar tipo", exact: true }).click();
  await page.getByRole("button", { name: /Opciones de entrega/ }).click();
  await page.getByRole("button", { name: "Cambiar tipo", exact: true }).click();
  await page.getByRole("button", { name: /Tallas o tamaños/ }).click();
  await expect(page.getByLabel("Nombre de la nueva elección")).toHaveValue(
    "Medida de mi producto",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(
    (await (await page.request.get("/api/products/" + p.id)).json()).draft
      .groups,
  ).toHaveLength(count);
  await page
    .getByRole("button", { name: "Añadir elección", exact: true })
    .click();
  await page.getByRole("button", { name: /Colores de una pieza/ }).click();
  const targets = page.getByLabel("¿En qué pieza?");
  await expect(targets.locator("option")).toHaveCount(4);
  await page.getByRole("button", { name: "Añadir a mi producto" }).click();
  await expect(page.locator(".tree-row")).toHaveCount(count + 1);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".tree-row")).toHaveCount(count);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(page.locator(".tree-row")).toHaveCount(count + 1);
  await page
    .getByRole("button", { name: "Probar como cliente", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continuar a publicación" })
    .click();
  await expect(
    page.getByRole("button", { name: "Publicar mi configurador", exact: true }),
  ).toBeEnabled();
});
test("A beginner with no files gets a transparent recommendation and a working starting model", async ({
  page,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Beginner",
      company: "New maker",
      email: "help@choices.test",
      password: "test-password-123",
    },
  });
  await page.goto("/?page=products&new=1");
  await page.getByLabel("¿Qué vas a vender?").fill("Mesa de mi taller");
  await page
    .getByRole("button", { name: "Muebles y espacios", exact: true })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByText("No sé qué elegir · ayúdame", { exact: true }).click();
  await page
    .getByRole("button", { name: "Todavía no tengo archivos", exact: true })
    .click();
  await expect(page.locator(".start-recommendation")).toContainText(
    "No representa automáticamente tu producto real",
  );
  await expect(
    page.getByRole("button", { name: /Mesa 3D lista para adaptar/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "artifacts/source-recommendation.png",
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Abrir mi mesa 3D", exact: true })
    .click();
  await expect(page.locator('[data-model-loaded="true"]')).toBeVisible();
  await expect(page.getByLabel("Nombre del producto")).toHaveValue(
    "Mesa de mi taller",
  );
});
