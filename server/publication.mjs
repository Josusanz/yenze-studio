import { validManifest, fail } from "./validation.mjs";
export async function publicationCheck({
  manifest,
  mode,
  assetCheck,
  checkPrint,
  paymentStatus,
  domains = [],
}) {
  const checks = [];
  const check = async (id, label, fn) => {
    try {
      await fn();
      checks.push({ id, label, state: "ready" });
    } catch (e) {
      if (!e.status || e.status >= 500) throw e;
      checks.push({ id, label, state: "blocked", detail: e.message });
    }
  };
  await check("product", "Producto y opciones", () =>
    validManifest(manifest, assetCheck, { publish: true }),
  );
  if (checks[0].state === "ready") {
    await check("originals", "Archivos de personalización", () =>
      checkPrint(manifest?.personalization?.design),
    );
  } else {
    checks.push({
      id: "originals",
      label: "Archivos de personalización",
      state: "blocked",
      detail: "Revisa primero el producto y sus opciones.",
    });
  }
  await check("checkout", "Cómo recibes las solicitudes", async () => {
    if (!["quote", "purchase"].includes(mode))
      fail("Elige presupuesto o compra.");
    if (mode === "purchase" && !(await paymentStatus()).chargesEnabled)
      fail(
        "Conecta una cuenta Stripe activa o elige Solicitar presupuesto.",
        409,
      );
  });
  checks.push({
    id: "embed",
    label: "Inserción en tu web",
    state: domains.length ? "ready" : "optional",
    detail: domains.length
      ? "Tu web está autorizada."
      : "Puedes compartir el enlace ahora. Para insertarlo en tu web, autoriza su dominio en Conexiones.",
  });
  return { ready: !checks.some((c) => c.state === "blocked"), checks };
}
