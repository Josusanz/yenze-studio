import { chromium, expect } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const base = "http://localhost:3060",
  entries = JSON.parse(readFileSync("data/local-examples.json", "utf8"));
const login = JSON.parse(
  readFileSync("/tmp/yenze-local-demo-login.json", "utf8"),
);
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--use-angle=swiftshader", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(20000);
page.on("dialog", (d) => d.accept());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("artifacts/examples", { recursive: true });
async function group(name) {
  await page.locator(".tree-row").filter({ hasText: name }).click();
}
try {
  await page.goto(base + "/?page=login");
  await page.getByLabel("Email", { exact: true }).fill(login.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(login.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
  const chair = entries.find((e) => e.type === "imported-3d");
  if (!chair.refined) {
    await page.goto(base + "/?edit=" + chair.id);
    for (const name of ["label", "metal"]) {
      await group(name);
      await page
        .getByRole("button", { name: "Eliminar elección", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Eliminar elección y sus hijos",
          exact: true,
        })
        .click();
    }
    await group("wood Brown");
    await page.getByLabel("Nombre del grupo").fill("Estructura de madera");
    await page.getByLabel("Nombre de opción").fill("Nogal");
    await page
      .getByRole("button", { name: "Añadir color", exact: true })
      .click();
    await page.getByLabel("Nombre de opción").last().fill("Madera oscura");
    await page.getByLabel("Color de opción").last().fill("#333a36");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      "Configurador publicado",
    );
    chair.refined = true;
    writeFileSync("data/local-examples.json", JSON.stringify(entries, null, 2));
  }
  const scenarios = {
    "photos-real": {
      choices: ["Latte frío", "Avena"],
      total: "4,50",
      hidden: "La leche",
    },
    "service-no-images": {
      choices: ["Presencial", "En tu empresa", "De 10 a 30 km", "Bono de tres"],
      total: "245,00",
    },
    "images-chair": { choices: ["Azul noche"], total: "455,00" },
    "scene-3d": { choices: ["Azul profundo"], total: "265,00" },
    "bicycle-layers": {
      choices: ["Azul noche", "Cesta de mimbre", "Aluminio"],
      total: "450,00",
    },
    "imported-3d": {
      choices: ["Oliva suave", "Madera oscura"],
      total: "205,00",
    },
  };
  for (const e of entries) {
    await page.goto(e.url);
    await expect(
      page.getByRole("heading", { name: e.name, exact: true }).first(),
    ).toBeVisible();
    const cfg = scenarios[e.type];
    if (cfg.hidden)
      await expect(
        page.getByRole("heading", { name: new RegExp(cfg.hidden) }),
      ).toHaveCount(0);
    for (const option of cfg.choices)
      await page
        .locator(".buyer-options")
        .getByRole("button", { name: new RegExp("^" + option + " ") })
        .click();
    await expect(page.locator(".buyer-total")).toContainText(cfg.total);
    if (e.type.includes("3d")) {
      await expect(page.locator(".model-preview canvas")).toBeVisible();
      await page.waitForTimeout(1200);
      await expect(
        page.getByText("No se puede mostrar este GLB.", { exact: false }),
      ).toHaveCount(0);
    }
    await page.screenshot({
      path: "artifacts/examples/" + e.type + "-configured.png",
      fullPage: true,
    });
    if (!e.configurationSaved) {
      await page
        .getByRole("button", { name: "Guardar configuración", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText(
        "Guardado en tu espacio",
      );
      e.configurationSaved = true;
      writeFileSync(
        "data/local-examples.json",
        JSON.stringify(entries, null, 2),
      );
    }
    await page.reload();
    for (const option of cfg.choices)
      await expect(
        page
          .locator(".buyer-options")
          .getByRole("button", { name: new RegExp("^" + option + " ") }),
      ).toHaveClass(/chosen/);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: "artifacts/examples/" + e.type + "-mobile.png",
    });
    await page
      .getByRole("button", { name: "Guardar configuración", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "artifacts/examples/" + e.type + "-mobile-checkout.png",
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    if (
      ["service-no-images", "bicycle-layers"].includes(e.type) &&
      !e.orderId
    ) {
      await page
        .getByRole("button", { name: "Solicitar presupuesto", exact: true })
        .click();
      await expect(page.locator(".modal .badge")).toContainText(
        "Solicitud recibida",
      );
      e.orderId = new URL(page.url()).searchParams.get("order");
      writeFileSync(
        "data/local-examples.json",
        JSON.stringify(entries, null, 2),
      );
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    }
    console.log(
      JSON.stringify({
        verified: e.name,
        total: cfg.total,
        saved: e.configurationSaved,
        order: e.orderId || null,
      }),
    );
  }
  await page.goto(base + "/?page=products");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "artifacts/examples/saved-library.png",
    fullPage: true,
  });
  await page.goto(base + "/?page=portal");
  await page.screenshot({
    path: "artifacts/examples/customer-portal.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
