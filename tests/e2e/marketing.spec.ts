import { test, expect } from "@playwright/test";
test("Marketing demo is interactive, responsive and leads directly into creation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?page=home&lang=es");
  await expect(page.locator(".hero h1")).toContainText("Crea configuradores de producto.");
  await page
    .getByRole("button", { name: "Acabado azul noche", exact: true })
    .click();
  await expect(page.locator(".hero-photo")).toHaveAttribute(
    "src",
    "/brand/lounge-blue.png",
  );
  await expect
    .poll(() =>
      page
        .locator(".hero-photo")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBeTruthy();
  await page.screenshot({
    path: "artifacts/marketing-desktop.png",
    fullPage: true,
  });
  await page.locator("#playground").scrollIntoViewIfNeeded();
  await expect(page.locator(".playground canvas")).toBeVisible();
  await page
    .locator(".demo-options")
    .getByRole("button", { name: "Azul", exact: true })
    .click();
  await expect(page.locator(".demo-total")).toContainText("260");
  await page.getByLabel("Ancho de la mesa de ejemplo").fill("190");
  await expect(page.locator(".range-label")).toContainText("190 cm");
  for (const path of ["/community.html", "/privacy.html", "/terms.html"]) {
    const r = await page.request.get(path);
    expect(r.status()).toBe(200);
    expect(await r.text()).toContain("<h1>");
  }
  await page
    .getByRole("button", { name: "¿Puedo usarlo sin imágenes?" })
    .click();
  await expect(page.locator("#faq-1")).toContainText("Sí.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Qué es Yenze", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar menú", exact: true }).click();
  await page.screenshot({
    path: "artifacts/marketing-mobile.png",
    fullPage: true,
  });
  await page.locator(".hero")
    .getByRole("link", { name: "Crear mi primer configurador", exact: true })
    .click();
  await expect(page.getByLabel("Nombre del negocio")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("new")).toBe("1");
  expect(errors).toEqual([]);
});
