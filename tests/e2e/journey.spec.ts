import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("A merchant publishes, a buyer configures, and both agree a quote", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?page=signup");
  await page.getByLabel("Tu nombre").fill("Josu");
  await page.getByLabel("Nombre del negocio").fill("Atelier Norte");
  await page.getByLabel("Email", { exact: true }).fill("owner@journey.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-password-123");
  await page.getByRole("button", { name: "Crear mi espacio" }).click();
  await expect(
    page.getByRole("heading", { name: "Las buenas ideas toman forma." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Crear configurador", exact: true })
    .click();
  await page.getByText("Ya sé lo que quiero: abrir una plantilla").click();
  await page.getByRole("button", { name: /Mueble a medida/ }).click();
  await expect(page.getByLabel("Nombre del producto")).toHaveValue(
    "Mueble a medida",
  );
  await expect(page.locator(".canvas .preview img")).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator(".canvas .preview img")
        .evaluateAll((imgs) =>
          imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBeTruthy();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ver publicado" })).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Ver publicado" })
    .getAttribute("href");
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/editor-desktop.png",
    fullPage: true,
  });
  const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    buyer = await ctx.newPage();
  buyer.on("pageerror", (e) => errors.push(e.message));
  await buyer.goto("http://127.0.0.1:3070" + href);
  await buyer.getByRole("button", { name: /Nogal/ }).click();
  await expect(buyer.locator(".buyer-total")).toContainText("485");
  await buyer.screenshot({
    path: "artifacts/configurator-desktop.png",
    fullPage: true,
  });
  await buyer.getByRole("button", { name: "Solicitar presupuesto" }).click();
  await buyer
    .getByRole("button", { name: "Crear una cuenta", exact: true })
    .click();
  await buyer.getByLabel("Tu nombre").fill("Ana");
  await buyer.getByLabel("Email", { exact: true }).fill("buyer@journey.test");
  await buyer
    .getByLabel("Contraseña", { exact: true })
    .fill("test-password-123");
  await buyer.getByRole("button", { name: "Crear mi espacio" }).click();
  await expect(buyer.locator(".overlay")).toHaveCount(0);
  await buyer.getByRole("button", { name: "Solicitar presupuesto" }).click();
  await expect(
    buyer.getByRole("heading", { name: "Hola, Ana." }),
  ).toBeVisible();
  await expect(buyer.locator(".modal .badge")).toContainText(
    "Solicitud recibida",
  );
  await buyer.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.goto("/?page=orders");
  await page.locator(".order-list>button").click();
  await page.getByLabel("Total (€)").fill("510");
  await page
    .getByLabel("Qué incluye")
    .fill("Mueble en nogal. Entrega incluida.");
  await page.getByRole("button", { name: "Enviar propuesta" }).click();
  await expect(page.locator(".modal .badge")).toContainText(
    "Presupuesto listo",
  );
  await buyer.reload();
  await buyer.locator(".order-list>button").click();
  await buyer.getByRole("button", { name: /Aceptar presupuesto/ }).click();
  await expect(buyer.locator(".modal .badge")).toContainText(
    "Pendiente de pago",
  );
  await buyer.getByRole("button", { name: /Pagar de forma segura/ }).click();
  await expect(buyer.getByRole("alert")).toContainText(
    "Stripe no está configurado",
  );
  await buyer.getByRole("button", { name: "Cerrar", exact: true }).click();
  await buyer.setViewportSize({ width: 390, height: 844 });
  await buyer.goto("http://127.0.0.1:3070" + href);
  await buyer.screenshot({
    path: "artifacts/configurator-mobile.png",
    fullPage: true,
  });
  expect(
    await buyer.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/?page=settings");
  await expect(
    page.getByRole("button", { name: "Conectar Stripe" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
  await ctx.close();
});
