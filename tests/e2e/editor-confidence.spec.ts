import { test, expect } from "@playwright/test";
const setup = async (page: any, email: string, template = "guided") => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Creator",
      company: "Studio test",
      email,
      password: "test-password-123",
    },
  });
  const p = await (
    await page.request.post("/api/products", { data: { template } })
  ).json();
  await page.goto("/?edit=" + p.id);
  return p;
};
test("Autosave persists edits and a failed save can be recovered after reload", async ({
  page,
}) => {
  const p = await setup(page, "autosave@confidence.test");
  await page.getByLabel("Nombre del producto").fill("Guardado automático");
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/products/" + p.id)).json()).draft
          .name,
    )
    .toBe("Guardado automático");
  await page.route("**/api/products/" + p.id, (route) =>
    route.request().method() === "PATCH"
      ? route.abort("failed")
      : route.continue(),
  );
  await page
    .getByLabel("Nombre del producto")
    .fill("Idea durante un corte de red");
  await expect(page.locator(".editor-save-warning")).toContainText(
    "No se han guardado",
  );
  await page.reload();
  await expect(page.locator(".editor-recovery")).toContainText("Hay cambios");
  await page.unroute("**/api/products/" + p.id);
  await page
    .getByRole("button", { name: "Recuperar cambios", exact: true })
    .click();
  await expect(page.getByLabel("Nombre del producto")).toHaveValue(
    "Idea durante un corte de red",
  );
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/products/" + p.id)).json()).draft
          .name,
    )
    .toBe("Idea durante un corte de red");
});
test("Publication explains missing assets and customer preview never sends an order", async ({
  page,
}) => {
  const p = await setup(page, "publication@confidence.test", "model");
  await page.getByRole("button", { name: "Publicación", exact: true }).click();
  await expect(page.getByLabel("Comprobación de publicación")).toContainText(
    "Sube un modelo GLB",
  );
  await expect(
    page.getByRole("button", { name: "Publicar mi configurador", exact: true }),
  ).toBeDisabled();
  const draft = await (
    await page.request.post("/api/products", { data: { template: "cabinet" } })
  ).json();
  await page.goto("/?edit=" + draft.id);
  await page
    .getByRole("button", { name: "Vista de cliente", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Vista previa de cliente" });
  await expect(preview).toBeVisible();
  await preview.getByRole("button", { name: "Móvil", exact: true }).click();
  await expect(preview.locator(".customer-preview-frame")).toHaveClass(
    /mobile/,
  );
  await expect(
    preview.getByRole("button", { name: "Solicitar presupuesto", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "artifacts/customer-preview-mobile.png",
    fullPage: true,
  });
  await preview.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Publicación", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Publicar mi configurador", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Publicar mi configurador", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copiar enlace", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "artifacts/publication-checklist.png",
    fullPage: true,
  });
  expect((await (await page.request.get("/api/orders")).json()).length).toBe(0);
});

test("Furniture recipe shows the product before configuring working 3D finishes", async ({
  page,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Furniture maker",
      company: "Wood Studio",
      email: "furniture@confidence.test",
      password: "test-password-123",
    },
  });
  await page.goto("/?page=products&new=1");
  await page
    .getByRole("button", { name: /Un mueble con mis acabados/ })
    .click();
  await expect(page.getByLabel("Pregunta 1", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Mesa 3D lista para adaptar/ }),
  ).toHaveClass(/active/);
  await page
    .getByRole("button", { name: "Abrir mi mesa 3D", exact: true })
    .click();
  await expect(page.locator(".onboarding-guide")).toContainText("PRIMERO");
  await expect(page.getByLabel("Nombre del producto")).toHaveValue(
    "Mi mesa a medida",
  );
  await expect(page.locator(".model-preview")).toHaveAttribute(
    "data-model-loaded",
    "true",
  );
  await page.getByRole("button", { name: "Probar", exact: true }).click();
  await page
    .locator(".test-panel")
    .getByRole("button", { name: /Azul noche/ })
    .click();
  await expect(page.locator(".canvas-bottom")).toContainText("260");
  await expect(page.locator(".test-panel")).toContainText(
    "Acabado del tablero",
  );
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copiar enlace", exact: true }),
  ).toBeEnabled();
});

test("A conflicting server edit is never overwritten by autosave or recovery", async ({
  page,
}) => {
  const p = await setup(page, "conflict@confidence.test");
  // The editor must hold the old revision before another session updates it.
  await expect(page.getByLabel("Nombre del producto")).toHaveValue(
    p.draft.name,
  );
  const remoteEdit = await page.request.patch("/api/products/" + p.id, {
    data: {
      revision: p.revision,
      manifest: { ...p.draft, name: "Cambio desde otra sesión" },
      mode: "quote",
    },
  });
  expect(remoteEdit.status()).toBe(200);
  await page.getByLabel("Nombre del producto").fill("Mi cambio local");
  await expect(page.locator(".editor-save-warning")).toContainText(
    "Hay cambios más recientes",
  );
  expect(
    (await (await page.request.get("/api/products/" + p.id)).json()).draft.name,
  ).toBe("Cambio desde otra sesión");
  await page.reload();
  await expect(page.locator(".editor-recovery")).toContainText("otra sesión");
  await expect(
    page.getByRole("button", { name: "Recuperar cambios", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Descargar copia", exact: true }),
  ).toBeVisible();
});

test("Customer preview traps keyboard focus and returns it to the editor", async ({
  page,
}) => {
  await setup(page, "keyboard@confidence.test", "cabinet");
  const trigger = page.getByRole("button", {
    name: "Vista de cliente",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Vista previa de cliente" });
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((e) => e.contains(document.activeElement)),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
