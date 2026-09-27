import { test, expect } from "@playwright/test";
test("A beginner resumes the assistant and creates a service with the guided recipe", async ({
  page,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Beginner",
      company: "Resume",
      email: "resume@browser.test",
      password: "password-example-123",
    },
  });
  await page.goto("/?page=products&new=1");
  await page.getByRole("button", { name: /Un servicio a medida/ }).click();
  await page.getByLabel("Pregunta 1", { exact: true }).fill("Dónde te ayudo");
  await page.reload();
  await expect(
    page.getByText("Hemos recuperado tu idea.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Pregunta 1", { exact: true })).toHaveValue(
    "Dónde te ayudo",
  );
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.locator(".wizard-summary")).toContainText("90,00");
  await page.getByRole("button", { name: /Crear mi configurador/ }).click();
  await expect(page).toHaveURL(/edit=/);
  const products = await (await page.request.get("/api/products")).json();
  expect(products).toHaveLength(1);
  expect(products[0].draft.kind).toBe("form");
  expect(products[0].draft.groups[0].label).toBe("Dónde te ayudo");
  await page.goto("/?page=settings");
  await expect(page.locator(".launch-readiness")).toContainText("Pagos Stripe");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/readiness-mobile.png",
    fullPage: true,
  });
});
test("Customer reviews the immutable order and approves the latest proof in the browser", async ({
  page,
  browser,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Merchant",
      company: "Approval",
      email: "approval@browser.test",
      password: "password-example-123",
    },
  });
  const p = await (
    await page.request.post("/api/products", {
      data: {
        template: "guided",
        setup: {
          name: "Asesoría editorial",
          industry: "service",
          basePrice: 9000,
          questions: [{ label: "Modalidad", answers: "Online, Presencial" }],
        },
      },
    })
  ).json();
  await page.request.post(`/api/products/${p.id}/publish`, {
    data: { revision: p.revision },
  });
  const context = await browser.newContext();
  const buyer = await context.newPage();
  await buyer.request.post("http://127.0.0.1:3070/api/auth/signup", {
    data: {
      name: "Buyer",
      email: "approval-buyer@browser.test",
      password: "password-example-123",
    },
  });
  await buyer.goto("http://127.0.0.1:3070" + p.publicPath);
  await buyer.getByRole("button", { name: /Solicitar presupuesto/ }).click();
  await expect(buyer.getByRole("dialog")).toBeVisible();
  const orders = await (await page.request.get("/api/orders")).json();
  const id = orders[0].id;
  await page.goto("/?page=orders");
  await page.getByRole("button", { name: /Asesoría editorial/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Qué debe revisar el cliente")
    .fill("Una sesión online de 60 minutos. Revisa la modalidad.");
  await page
    .getByRole("button", {
      name: "Solicitar aprobación del cliente",
      exact: true,
    })
    .click();
  await buyer.reload();
  await expect(buyer.locator(".proof-panel")).toContainText("Revisión 1");
  await buyer.getByRole("checkbox").check();
  await buyer.getByRole("button", { name: "Aprobar esta versión" }).click();
  await expect(buyer.locator(".proof-panel")).toContainText("Aprobada el");
  const packet = await (
    await page.request.get(`/api/orders/${id}/production-file`)
  ).json();
  expect(packet.proof.approved_at).toBeTruthy();
  expect(packet.choices[0].answer).toBe("Online");
  await buyer.screenshot({
    path: "artifacts/customer-proof.png",
    fullPage: true,
  });
  await context.close();
});
test("Embed SDK validates frame identity and exchanges a server-priced cart ticket", async ({
  page,
}) => {
  await page.request.post("/api/auth/signup", {
    data: {
      name: "Embed",
      company: "Embed",
      email: "embed-sdk@browser.test",
      password: "password-example-123",
    },
  });
  const p = await (
    await page.request.post("/api/products", {
      data: {
        template: "guided",
        setup: {
          name: "Servicio integrado",
          industry: "service",
          basePrice: 4900,
          questions: [{ label: "Formato", answers: "Online, Presencial" }],
        },
      },
    })
  ).json();
  await page.request.post(`/api/products/${p.id}/publish`, {
    data: { revision: p.revision },
  });
  await page.route("**/embed-harness.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<div id="app"></div><script src="/yenze-embed.js"></script><script>window.tickets=[];window.instance=Yenze.mount('#app',{url:${JSON.stringify(p.publicPath)},onCart:v=>window.tickets.push(v.ticket)});</script>`,
    }),
  );
  await page.goto("/embed-harness.html");
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://evil.example",
        source: document.querySelector("iframe")!.contentWindow,
        data: { protocol: "yenze:1", type: "cart", ticket: "a".repeat(64) },
      }),
    ),
  );
  expect(await page.evaluate(() => (window as any).tickets)).toHaveLength(0);
  await page
    .frameLocator("iframe")
    .getByRole("button", { name: "Añadir a mi carrito" })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).tickets.length))
    .toBe(1);
  const ticket = await page.evaluate(() => (window as any).tickets[0]);
  const r = await page.request.post("/api/commerce/resolve", {
    data: { ticket },
  });
  expect(r.ok()).toBe(true);
  expect((await r.json()).amount).toBe(4900);
  await page.evaluate(() => (window as any).instance.destroy());
  await expect(page.locator("iframe")).toHaveCount(0);
});
