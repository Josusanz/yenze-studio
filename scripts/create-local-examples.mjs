// Repeatable browser authoring exercise. Credentials live outside the repository.
import { chromium, expect } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
const root = process.cwd(),
  base = process.env.YENZE_DEMO_ORIGIN || "http://localhost:3060";
const credentials = JSON.parse(
  readFileSync(
    process.env.YENZE_DEMO_CREDENTIALS || "/tmp/yenze-local-demo-login.json",
    "utf8",
  ),
);
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1512, height: 982 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const file = path.join(root, "data/local-examples.json");
let entries = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
mkdirSync("artifacts/examples", { recursive: true });
async function wizard(name, business, questions, price, source) {
  const saved = entries.find((v) => v.name === name && v.status === "draft");
  if (saved) {
    await page.goto(base + "/?edit=" + saved.id);
    await expect(page.getByLabel("Nombre del producto")).toHaveValue(name);
    return saved.id;
  }
  await page.goto(base + "/?page=products");
  await page
    .getByRole("button", { name: "Crear configurador", exact: true })
    .click();
  await page.getByLabel("¿Qué vas a vender?").fill(name);
  await page.getByRole("button", { name: business, exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  for (let i = 0; i < questions.length; i++) {
    if (i >= 2)
      await page.getByRole("button", { name: "Añadir otra pregunta" }).click();
    await page
      .getByLabel("Pregunta " + (i + 1), { exact: true })
      .fill(questions[i][0]);
    await page.getByLabel("Respuestas " + (i + 1)).fill(questions[i][1]);
  }
  await page.getByLabel("Precio desde (€)").fill(String(price));
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(source) }).click();
  await page
    .getByRole("button", { name: "Crear mi configurador", exact: true })
    .click();
  await expect(page.getByLabel("Nombre del producto")).toHaveValue(name);
  const id = new URL(page.url()).searchParams.get("edit");
  entries.push({ id, name, status: "draft" });
  writeFileSync(file, JSON.stringify(entries, null, 2));
  return id;
}
async function finish(name, id, type) {
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ver publicado" })).toBeVisible({
    timeout: 15000,
  });
  const entry = entries.find((v) => v.id === id);
  Object.assign(entry, {
    status: "published",
    type,
    url: base + "/?product=" + id,
  });
  writeFileSync(file, JSON.stringify(entries, null, 2));
  await page.getByRole("button", { name: "Probar", exact: true }).click();
  await page.screenshot({
    path: "artifacts/examples/" + type + "-editor.png",
    fullPage: true,
  });
  const buyer = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  await buyer.goto(entry.url);
  await expect(
    buyer.getByRole("heading", { name, exact: true }).first(),
  ).toBeVisible();
  if (type.includes("3d")) {
    await expect(buyer.locator(".model-preview canvas")).toBeVisible();
    await buyer.waitForTimeout(1600);
  }
  await buyer.screenshot({
    path: "artifacts/examples/" + type + "-buyer.png",
    fullPage: true,
  });
  await buyer.close();
  console.log(JSON.stringify({ created: name, id, type }));
}
async function selectGroup(label) {
  await page.getByRole("button", { name: "Construir", exact: true }).click();
  await page.getByRole("button", { name: /Elecciones/ }).click();
  await page
    .locator(".tree-row")
    .filter({ has: page.locator("strong", { hasText: label }) })
    .getByRole("button")
    .first()
    .click();
}
async function addOption(name, price = 0, color) {
  await page.getByRole("button", { name: /^Añadir (opción|color)$/ }).click();
  const inputs = page.getByLabel("Nombre de opción");
  await inputs.last().fill(name);
  if (price)
    await page
      .getByLabel("Suplemento " + name, { exact: true })
      .fill(String(price));
  if (color) await page.getByLabel("Color de opción").last().fill(color);
}
try {
  await page.goto(base + "/?page=login");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(credentials.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
  const jobs = [
    {
      name: "Bicicleta Urbana · Capas 2D",
      type: "bicycle-layers",
      run: async () => {
        const id = await wizard(
          "Bicicleta Urbana · Capas 2D",
          "Un producto",
          [
            ["Cuadro", "Salvia, Azul"],
            ["Accesorios", "Sin extras, Con cesta"],
          ],
          390,
          "Tengo capas de imagen",
        );
        await page.getByText("Ya tengo una carpeta organizada").click();
        await page
          .locator("input[webkitdirectory]")
          .setInputFiles("examples/assets/bicycle-layers");
        await expect(page.getByRole("status")).toContainText(
          "Capas importadas",
        );
        await page.getByRole("button", { name: /Elecciones/ }).click();
        await page.locator(".tree-row").filter({ hasText: "Cesta" }).click();
        await page
          .getByLabel("Suplemento Cesta de mimbre", { exact: true })
          .fill("35");
        await page
          .locator(".tree-row")
          .filter({ hasText: "Guardabarros" })
          .click();
        await page
          .getByLabel("Suplemento Aluminio", { exact: true })
          .fill("25");
        return id;
      },
    },
    {
      name: "Café a tu manera · Fotos reales",
      type: "photos-real",
      run: async () => {
        const id = await wizard(
          "Café a tu manera · Fotos reales",
          "Un producto",
          [
            ["Tamaño", "Normal, Grande"],
            ["Recogida", "Para llevar, En la cafetería"],
          ],
          2.8,
          "Tengo fotos",
        );
        await page.getByLabel("Subir imágenes del producto").setInputFiles([
          {
            name: "Espresso.jpg",
            mimeType: "image/jpeg",
            buffer: readFileSync("examples/assets/cafe.jpg"),
          },
          {
            name: "Latte frío.jpg",
            mimeType: "image/jpeg",
            buffer: readFileSync("examples/assets/latte.jpg"),
          },
        ]);
        await expect(page.getByLabel("Nombre del grupo")).toHaveValue(
          "Elige tu versión",
        );
        await page.getByLabel("Nombre del grupo").fill("Tu café");
        await page
          .getByLabel("Suplemento Latte frío", { exact: true })
          .fill("1.2");
        await page
          .getByRole("button", {
            name: "Añadir subopción a «Latte frío»",
            exact: true,
          })
          .click();
        await page.getByLabel("Nombre del grupo").fill("La leche");
        await page.getByLabel("Nombre de opción").fill("Entera");
        await addOption("Avena", 0.5);
        await addOption("Sin lactosa", 0.3);
        return id;
      },
    },
    {
      name: "Mentoría a tu ritmo · Sin imágenes",
      type: "service-no-images",
      run: async () => {
        const id = await wizard(
          "Mentoría a tu ritmo · Sin imágenes",
          "Servicios y experiencias",
          [
            ["Modalidad", "Online, Presencial"],
            ["Sesiones", "Una sesión, Bono de tres, Bono de seis"],
          ],
          65,
          "Aún no tengo",
        );
        await page
          .getByLabel("Suplemento Presencial", { exact: true })
          .fill("20");
        await page
          .getByRole("button", {
            name: "Añadir subopción a «Presencial»",
            exact: true,
          })
          .click();
        await page.getByLabel("Nombre del grupo").fill("Dónde nos vemos");
        await page.getByLabel("Nombre de opción").fill("En el estudio");
        await addOption("En tu empresa", 30);
        await page
          .getByRole("button", {
            name: "Añadir subopción a «En tu empresa»",
            exact: true,
          })
          .click();
        await page.getByLabel("Nombre del grupo").fill("Desplazamiento");
        await page.getByLabel("Nombre de opción").fill("Hasta 10 km");
        await addOption("De 10 a 30 km", 15);
        await page.locator(".tree-row").filter({ hasText: "Sesiones" }).click();
        await page
          .getByLabel("Suplemento Bono de tres", { exact: true })
          .fill("115");
        await page
          .getByLabel("Suplemento Bono de seis", { exact: true })
          .fill("265");
        return id;
      },
    },
    {
      name: "Butaca Nube · Imágenes de producto",
      type: "images-chair",
      run: async () => {
        const id = await wizard(
          "Butaca Nube · Imágenes de producto",
          "Muebles y espacios",
          [
            ["Entrega", "Recogida en taller, Entrega a domicilio"],
            ["Protección", "Sin protección extra, Tratamiento antimanchas"],
          ],
          420,
          "Tengo fotos",
        );
        await page.getByLabel("Subir imágenes del producto").setInputFiles([
          {
            name: "Bouclé marfil.png",
            mimeType: "image/png",
            buffer: readFileSync("public/brand/lounge-original.png"),
          },
          {
            name: "Azul noche.png",
            mimeType: "image/png",
            buffer: readFileSync("public/brand/lounge-blue.png"),
          },
        ]);
        await expect(page.getByLabel("Nombre del grupo")).toHaveValue(
          "Elige tu versión",
        );
        await page.getByLabel("Nombre del grupo").fill("Tapizado");
        await page
          .getByLabel("Suplemento Azul noche", { exact: true })
          .fill("35");
        return id;
      },
    },
    {
      name: "Mesa Forma · Construida en 3D",
      type: "scene-3d",
      run: async () => {
        const id = await wizard(
          "Mesa Forma · Construida en 3D",
          "Muebles y espacios",
          [
            ["Montaje", "Sin montaje, Montaje incluido"],
            ["Entrega", "Recogida en taller, Envío a domicilio"],
          ],
          240,
          "Quiero construirlo",
        );
        await page
          .getByRole("button", { name: /Empezar con una mesa editable/ })
          .click();
        await page
          .getByRole("button", { name: "Tablero", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Permitir elegir su color" })
          .click();
        await page.getByLabel("Nombre del grupo").fill("Acabado del tablero");
        await page.getByLabel("Nombre de opción").fill("Roble natural");
        await page.getByLabel("Color de opción").fill("#c8ad83");
        await addOption("Azul profundo", 25, "#36556b");
        await addOption("Arcilla", 25, "#b27862");
        return id;
      },
    },
    {
      name: "Silla Atelier · Modelo 3D importado",
      type: "imported-3d",
      run: async () => {
        const id = await wizard(
          "Silla Atelier · Modelo 3D importado",
          "Muebles y espacios",
          [
            ["Entrega", "En taller, A domicilio"],
            ["Montaje", "Sin montaje, Montaje incluido"],
          ],
          185,
          "Tengo un modelo 3D",
        );
        await page
          .getByLabel("Subir modelo GLB")
          .setInputFiles("examples/assets/SheenChair.glb");
        await expect(
          page.getByText("Modelo reconocido", { exact: true }),
        ).toBeVisible({ timeout: 20000 });
        await page.getByRole("button", { name: /Elecciones/ }).click();
        await page
          .locator(".tree-row")
          .filter({ hasText: "fabric Mystere Mango Velvet" })
          .click();
        await page
          .getByLabel("Nombre del grupo")
          .fill("Tapizado de terciopelo");
        await page.getByLabel("Nombre de opción").fill("Mostaza original");
        await addOption("Oliva suave", 20, "#a7c992");
        await addOption("Tierra", 15, "#caa393");
        return id;
      },
    },
  ];
  for (const job of jobs) {
    const existing = entries.find(
      (v) => v.name === job.name && v.status === "published",
    );
    if (existing) {
      console.log("Already saved: " + job.name);
      continue;
    }
    const draft = entries.find(
      (v) => v.name === job.name && v.status === "draft",
    );
    if (draft) console.log("Resuming draft: " + draft.id);
    const id = await job.run();
    await finish(job.name, id, job.type);
  }
  await page.goto(base + "/?page=products");
  await page.screenshot({
    path: "artifacts/examples/saved-library.png",
    fullPage: true,
  });
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
}
