import { test, expect } from "@playwright/test";
for (const viewport of [
  { width: 1024, height: 580 },
  { width: 390, height: 640 },
]) {
  test(`Creation assistant scrolls and keeps navigation reachable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.request.post("/api/auth/signup", {
      data: {
        name: "Scroll test",
        company: "Scroll",
        email: `scroll-${viewport.width}@example.test`,
        password: "scroll-password-123",
      },
    });
    await page.goto("/?page=products&new=1");
    await page
      .getByRole("button", { name: /Una camiseta con mi diseño/ })
      .click();
    const dialog = page.getByRole("dialog");
    const scroller = dialog.locator(".wizard-scroll");
    await expect(page.getByLabel("Pregunta 1", { exact: true })).toHaveValue(
      "Talla",
    );
    const before = await scroller.evaluate((e) => ({
      top: e.scrollTop,
      height: e.clientHeight,
      total: e.scrollHeight,
    }));
    expect(before.total).toBeGreaterThan(before.height);
    const rect = await scroller.boundingBox();
    await page.mouse.move(
      rect!.x + rect!.width - 20,
      rect!.y + rect!.height / 2,
    );
    await page.mouse.wheel(0, 1600);
    await expect
      .poll(() => scroller.evaluate((e) => e.scrollTop))
      .toBeGreaterThan(0);
    await expect(page.getByLabel("Precio desde (€)")).toBeInViewport();
    const next = page.getByRole("button", { name: "Continuar", exact: true });
    await expect(next).toBeInViewport();
    await expect(
      dialog.getByRole("button", { name: "Cerrar", exact: true }),
    ).toBeInViewport();
    await next.click();
    await expect.poll(() => scroller.evaluate((e) => e.scrollTop)).toBe(0);
    await page.mouse.move(
      rect!.x + rect!.width - 20,
      rect!.y + rect!.height / 2,
    );
    await page.mouse.wheel(0, 1800);
    const create = page.getByRole("button", { name: "Crear mi configurador" });
    await expect(create).toBeInViewport();
    await create.click();
    await expect(page).toHaveURL(/edit=/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
}
