import { test, expect } from "@playwright/test";
import sharp from "sharp";
for (const route of [
  {
    id: "photos",
    choice: "Tengo fotos de mi producto",
    action: "Subir mis fotos",
  },
  { id: "layers", choice: "Tengo capas de imagen", action: "Subir mis capas" },
  { id: "model", choice: "Tengo un modelo 3D", action: "Subir mi modelo 3D" },
  {
    id: "scene",
    choice: "Quiero construirlo en 3D",
    action: "Abrir el constructor 3D",
  },
]) {
  test(`Product-first onboarding: ${route.id} reaches a visible product before options`, async ({
    page,
  }) => {
    await page.request.post("/api/auth/signup", {
      data: {
        name: "First timer",
        company: "Visual onboarding",
        email: `${route.id}@visual-onboarding.test`,
        password: "test-password-123",
      },
    });
    await page.goto("/?page=products&new=1");
    await page.getByLabel("¿Qué vas a vender?").fill("Mi producto visual");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByLabel("Pregunta 1", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: new RegExp(route.choice) }).click();
    await page.getByRole("button", { name: route.action, exact: true }).click();
    await expect(page).toHaveURL(/onboarding=1/);
    const next = page.getByRole("button", { name: /Ahora, qué podrá elegir/ });
    await expect(next).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /Elecciones/ }),
    ).toBeDisabled();
    if (route.id === "model") {
      await page
        .getByLabel("Subir modelo GLB")
        .setInputFiles("public/models/atelier-shirt-v2.glb");
      await expect(page.locator('[data-model-loaded="true"]')).toBeVisible({
        timeout: 30000,
      });
    } else if (route.id === "scene") {
      await page
        .getByRole("button", { name: /Empezar con una mesa editable/ })
        .click();
      await expect(page.locator(".piece-list button")).toHaveCount(5);
    } else {
      await page.getByLabel("Subir imágenes del producto").setInputFiles({
        name: "mi-producto.png",
        mimeType: "image/png",
        buffer: await sharp({
          create: {
            width: 640,
            height: 480,
            channels: 4,
            background: "#b8c9da",
          },
        })
          .png()
          .toBuffer(),
      });
      await expect(page.locator(".source-summary")).toContainText(
        "1 grupos visuales",
      );
    }
    await expect(next).toBeEnabled();
    await expect(page.locator(".onboarding-guide")).toContainText("PRIMERO");
    await page.screenshot({ path: `artifacts/onboarding-${route.id}.png` });
    await next.click();
    await expect(page.locator(".onboarding-guide")).toContainText("DESPUÉS");
    await expect(page.getByRole("button", { name: /Elecciones/ })).toHaveClass(
      /active/,
    );
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Ahora, qué podrá elegir/ }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Configurar opciones", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cerrar esta guía", exact: true })
      .click();
    await expect(page).not.toHaveURL(/onboarding=/);
    await page.getByRole("button", { name: "Producto", exact: true }).click();
    await expect(
      page.getByLabel("Descripción para tus clientes"),
    ).toBeVisible();
    const products = await (await page.request.get("/api/products")).json();
    expect(products).toHaveLength(1);
    expect(products[0].draft.name).toBe("Mi producto visual");
  });
}

test("A failed draft creation keeps the selected starting point and can be retried", async ({
  page,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Retry",
      company: "Retry Studio",
      email: "retry@visual-onboarding.test",
      password: "test-password-123",
    },
  });
  await page.goto("/?page=products&new=1");
  await page
    .getByRole("button", { name: /Un mueble con mis acabados/ })
    .click();
  await page.route("**/api/products", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "No disponible temporalmente. Inténtalo de nuevo.",
        }),
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Abrir mi mesa 3D", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "No disponible temporalmente",
  );
  await expect(
    page.getByRole("button", { name: /Mesa 3D lista para adaptar/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.unroute("**/api/products");
  await page
    .getByRole("button", { name: "Abrir mi mesa 3D", exact: true })
    .click();
  await expect(page.getByLabel("Nombre del producto")).toHaveValue(
    "Mi mesa a medida",
  );
  expect(await (await page.request.get("/api/products")).json()).toHaveLength(
    1,
  );
});
