import { test, expect } from "@playwright/test";
test("Novice sector discovery preserves edits and creation is atomic", async ({
  page,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Novice",
      company: "Sector test",
      email: "sector@browser.test",
      password: "test-password-123",
    },
  });
  await page.goto("/?page=products&new=1");
  await page
    .getByPlaceholder("Por ejemplo: una mesa, una bicicleta o un curso")
    .fill("Mi café");
  await page.getByRole("button", { name: "Explorar los 12 sectores" }).click();
  await page.getByLabel("Buscar sector").fill("cafe");
  await page.getByRole("button", { name: /Alimentación y bebidas/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByLabel("Pregunta 1", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Continuar sin imágenes/ }).click();
  await page.getByRole("button", { name: "Atrás", exact: true }).click();
  await expect(page.getByLabel("¿Qué vas a vender?")).toHaveValue("Mi café");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(
    page.getByRole("button", { name: /Continuar sin imágenes/ }),
  ).toHaveClass(/active/);
  await page
    .getByRole("button", { name: "Crear mi ficha", exact: true })
    .click();
  await expect(page).toHaveURL(/edit=/);
  await page.getByRole("button", { name: /Ahora, qué podrá elegir/ }).click();
  await expect(page.getByLabel("Nombre del grupo")).toHaveValue("Formato");
  const before = await (await page.request.get("/api/products")).json();
  expect(before).toHaveLength(1);
  expect(before[0].draft.groups[0].label).toBe("Formato");
  const bad = await page.request.post("/api/products", {
    data: {
      template: "guided",
      setup: {
        name: "Inválido",
        industry: "food",
        basePrice: 0,
        questions: [{ label: "a", answers: "a, A" }],
      },
    },
  });
  expect(bad.status()).toBe(400);
  expect(await (await page.request.get("/api/products")).json()).toHaveLength(
    1,
  );
});
test("Image-free storefront is responsive, embeddable and retains options across layouts", async ({
  page,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Services",
      company: "Estudio editorial",
      email: "formstyle@browser.test",
      password: "test-password-123",
    },
  });
  const p = await (
    await page.request.post("/api/products", {
      data: {
        template: "guided",
        setup: {
          name: "Tu próxima gran idea",
          industry: "service",
          basePrice: 12000,
          questions: [
            { label: "Cómo nos encontramos", answers: "Online, En tu estudio" },
            {
              label: "El tiempo que necesitas",
              answers: "Una sesión, Un acompañamiento",
            },
          ],
        },
      },
    })
  ).json();
  p.draft.description =
    "Un espacio para pensar, elegir un rumbo y dar el siguiente paso.";
  p.draft.presentation = { layout: "editorial", tone: "olive" };
  p.draft.groups[1].options[1].priceDelta = 24000;
  const saved = await (
    await page.request.patch("/api/products/" + p.id, {
      data: { revision: p.revision, manifest: p.draft, mode: "quote" },
    })
  ).json();
  expect(
    (
      await page.request.post("/api/products/" + p.id + "/publish", {
        data: { revision: saved.revision },
      })
    ).status(),
  ).toBe(200);
  await page.goto(p.publicPath + "?embed=1");
  await expect(page.locator(".store-head")).toHaveCount(0);
  await page.getByRole("button", { name: /Un acompañamiento/ }).click();
  await expect(page.locator(".buyer-total")).toContainText("360");
  await expect(page.locator(".summary-selections")).toContainText(
    "Un acompañamiento",
  );
  await page.screenshot({ path: "artifacts/form-editorial.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: /Solicitar presupuesto/ }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/form-mobile.png", fullPage: true });
  const draft = await (await page.request.get("/api/products/" + p.id)).json();
  draft.draft.presentation = { layout: "compact", tone: "plum" };
  const update = await (
    await page.request.patch("/api/products/" + p.id, {
      data: { revision: draft.revision, manifest: draft.draft, mode: "quote" },
    })
  ).json();
  await page.request.post("/api/products/" + p.id + "/publish", {
    data: { revision: update.revision },
  });
  await page.reload();
  await expect(page.locator(".form-compact.tone-plum")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Un acompañamiento/ }),
  ).toHaveAttribute("aria-pressed", "true");
});
