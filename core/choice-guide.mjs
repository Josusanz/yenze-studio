/** Small, editable starting points. No inferred geometry or manufacturing promises. */
export function choiceTargets(m, effect) {
  const used = new Set(
    m.groups
      .filter((g) => g.effect === effect)
      .map((g) => (effect === "material" ? g.material : g.node)),
  );
  const targets =
    m.kind === "scene-3d"
      ? (m.objects || []).map((o) => ({ id: o.id, label: o.name }))
      : effect === "material"
        ? (m.modelInfo?.materials || []).map((n) => ({ id: n, label: n }))
        : (m.modelInfo?.nodes || []).map((n) => ({
            id: n.name,
            label: n.label || n.name,
          }));
  return targets.filter((t) => !used.has(t.id));
}
export function choicePreset(kind) {
  const rows = (labels) => labels.map((label) => ({ label, price: "0" }));
  if (kind === "size")
    return {
      label: "Talla",
      effect: "choice",
      options: rows(["S", "M", "L", "XL"]),
    };
  if (kind === "delivery")
    return {
      label: "Entrega",
      effect: "choice",
      options: rows(["Recogida en tienda", "Envío a domicilio"]),
    };
  if (kind === "service")
    return {
      label: "Modalidad",
      effect: "choice",
      options: rows(["Online", "Presencial"]),
    };
  if (kind === "material")
    return {
      label: "Color",
      effect: "material",
      options: rows(["Natural", "Azul noche", "Arcilla"]).map((o, i) => ({
        ...o,
        color: ["#c8ad83", "#36556b", "#b27862"][i],
      })),
    };
  if (kind === "visibility")
    return {
      label: "Añadir accesorio",
      effect: "visibility",
      options: [
        { label: "Sin accesorio", price: "0", visible: false },
        { label: "Con accesorio", price: "0", visible: true },
      ],
    };
  return { label: "", effect: "choice", options: rows(["", ""]) };
}
export function buildGuidedChoice(m, draft, uid) {
  const fail = (message) => {
    throw Error(message);
  };
  if (!draft.label?.trim() || draft.label.trim().length > 80)
    fail("Pon un nombre a esta elección.");
  if (!["choice", "material", "visibility"].includes(draft.effect))
    fail("Elige qué quieres ofrecer.");
  if (
    !Array.isArray(draft.options) ||
    draft.options.length < 2 ||
    draft.options.length > 100
  )
    fail("Añade al menos dos opciones.");
  if (
    m.groups.length >= 40 ||
    m.groups.reduce((n, g) => n + g.options.length, 0) + draft.options.length >
      500
  )
    fail("Este producto ha alcanzado el límite de opciones.");
  const seen = new Set();
  const options = draft.options.map((o) => {
    const label = o.label.trim(),
      key = label.toLocaleLowerCase();
    if (!label || label.length > 80)
      fail("Escribe un nombre para cada opción.");
    if (seen.has(key))
      fail(
        "Usa nombres distintos para que el cliente pueda distinguir las opciones.",
      );
    seen.add(key);
    const amount = Number(String(o.price).replace(",", ".")),
      priceDelta = Math.round(amount * 100);
    if (
      !String(o.price).trim() ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isSafeInteger(priceDelta) ||
      priceDelta > 100000000
    )
      fail("Revisa los suplementos: usa un importe de 0 € o más.");
    const option = { id: uid(), label, priceDelta };
    if (draft.effect === "material") {
      if (!/^#[a-f\d]{6}$/i.test(o.color || "")) fail("Elige un color válido.");
      option.color = o.color;
    }
    if (draft.effect === "visibility") {
      if (typeof o.visible !== "boolean")
        fail("Indica si la pieza aparece en cada opción.");
      option.visible = o.visible;
    }
    return option;
  });
  const g = {
    id: uid(),
    label: draft.label.trim(),
    effect: draft.effect,
    order: m.groups.reduce((n, g) => Math.max(n, g.order + 1), 0),
    required: true,
    default: options[0].id,
    options,
  };
  if (draft.effect !== "choice") {
    if (
      !["model-3d", "scene-3d"].includes(m.kind) ||
      !choiceTargets(m, draft.effect).some((t) => t.id === draft.target)
    )
      fail("Elige la pieza que quieres personalizar.");
    g[draft.effect === "material" ? "material" : "node"] = draft.target;
  }
  return g;
}
