import { printZone } from "../core/print-quality.mjs";
import { validatePrint, resolvePrint } from "../core/print-design.mjs";
import { evaluate, hierarchy, effectOf } from "../core/layers.mjs";
export const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export function text(v, max = 120) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    fail("Texto no válido.");
  return v.trim();
}
export const idPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/;
export function validManifest(m, assetCheck, { publish = false } = {}) {
  if (
    !m ||
    m.schemaVersion !== 1 ||
    !["layers-2d", "images-2d", "model-3d", "scene-3d", "form"].includes(
      m.kind,
    ) ||
    m.currency !== "EUR" ||
    !Number.isSafeInteger(m.basePrice) ||
    m.basePrice < 0 ||
    m.basePrice > 100000000
  )
    fail("Revisa el producto y el precio.");
  text(m.name);
  if (
    m.presentation !== undefined &&
    (!m.presentation ||
      !["editorial", "compact"].includes(m.presentation.layout) ||
      !["ink", "olive", "plum"].includes(m.presentation.tone))
  )
    fail("Elige una presentación y un estilo válidos.");
  if (m.personalization !== undefined) {
    if (
      !m.personalization ||
      m.kind !== "model-3d" ||
      m.personalization.type !== "shirt" ||
      m.personalization.version !== 1 ||
      !["studio-shirt-v1", "atelier-shirt-v2"].includes(m.personalization.model)
    )
      fail("Editor textil no válido.");
    try {
      m.personalization.design = validatePrint(m.personalization.design);
      if (m.personalization.printZone !== undefined)
        m.personalization.printZone = printZone(m.personalization);
      if (
        m.personalization.cleanStart !== undefined &&
        typeof m.personalization.cleanStart !== "boolean"
      )
        fail("Estado de diseño no válido.");
    } catch (e) {
      fail(e.message);
    }
  }
  if (
    m.description !== undefined &&
    (typeof m.description !== "string" || m.description.length > 300)
  )
    fail("La descripción admite hasta 300 caracteres.");
  if (
    !m.canvas ||
    ![m.canvas.width, m.canvas.height].every(
      (v) => Number.isInteger(v) && v > 0 && v <= 8192,
    )
  )
    fail("Lienzo no válido.");
  if (
    !Array.isArray(m.views) ||
    !m.views.length ||
    m.views.length > 12 ||
    m.views.some((v) => typeof v !== "string" || !idPattern.test(v)) ||
    new Set(m.views).size !== m.views.length
  )
    fail("Vistas no válidas.");
  if (
    !Array.isArray(m.groups) ||
    m.groups.length > 40 ||
    !Array.isArray(m.rules) ||
    m.rules.length > 200
  )
    fail("Demasiados grupos o reglas.");
  const ids = new Set(),
    orders = new Set();
  let count = 0;
  for (const g of m.groups) {
    if (
      !g ||
      typeof g.id !== "string" ||
      !idPattern.test(g.id) ||
      ids.has(g.id) ||
      !Number.isInteger(g.order) ||
      g.order < 0 ||
      orders.has(g.order) ||
      typeof g.required !== "boolean" ||
      !Array.isArray(g.options) ||
      !g.options.length ||
      g.options.length > 100
    )
      fail("Grupo no válido.");
    ids.add(g.id);
    orders.add(g.order);
    text(g.label, 80);
    const opts = new Set();
    for (const o of g.options) {
      count++;
      if (
        !o ||
        typeof o.id !== "string" ||
        !idPattern.test(o.id) ||
        opts.has(o.id) ||
        !Number.isSafeInteger(o.priceDelta) ||
        o.priceDelta < 0 ||
        o.priceDelta > 100000000
      )
        fail("Revisa las opciones y sus precios.");
      opts.add(o.id);
      text(o.label, 80);
      if (o.color && !/^#[a-f\d]{6}$/i.test(o.color)) fail("Color no válido.");
      const effect = effectOf(m, g);
      if (
        !["layer", "image", "choice", "material", "visibility"].includes(effect)
      )
        fail("Tipo de opción no válido.");
      if (["layer", "image"].includes(effect)) {
        if (!["layers-2d", "images-2d"].includes(m.kind))
          fail("Las imágenes requieren un configurador 2D.");
        for (const view of m.views) {
          const asset = o.assets?.[view];
          if (!asset) {
            if (publish)
              fail("Falta imagen en " + g.label + " · " + o.label + ".");
            continue;
          }
          if (
            !assetCheck(
              asset,
              "image",
              effect === "layer" ? m.canvas : undefined,
            )
          )
            fail(
              "La capa debe pertenecer a esta empresa y tener las dimensiones del lienzo.",
            );
        }
      } else if (effect === "material") {
        if (
          !["model-3d", "scene-3d"].includes(m.kind) ||
          typeof g.material !== "string" ||
          !g.material ||
          g.material.length > 120 ||
          !o.color
        )
          fail("Asigna un material y un color.");
      } else if (effect === "visibility") {
        if (
          !["model-3d", "scene-3d"].includes(m.kind) ||
          typeof g.node !== "string" ||
          !g.node ||
          g.node.length > 120 ||
          typeof o.visible !== "boolean"
        )
          fail("Asigna una pieza y su visibilidad.");
      }
    }
    if (!opts.has(g.default)) fail("Opción predeterminada no válida.");
  }
  try {
    hierarchy(m.groups);
  } catch (e) {
    fail(e.message);
  }
  if (m.kind === "scene-3d") {
    if (!Array.isArray(m.objects) || m.objects.length > 100)
      fail("Máximo 100 piezas por escena.");
    const ids = new Set();
    for (const o of m.objects) {
      if (
        !o ||
        typeof o.id !== "string" ||
        !idPattern.test(o.id) ||
        ids.has(o.id) ||
        !["box", "sphere", "cylinder"].includes(o.type) ||
        !/^#[a-f\d]{6}$/i.test(o.color)
      )
        fail("Pieza 3D no válida.");
      ids.add(o.id);
      text(o.name, 80);
      for (const key of ["size", "position"])
        if (
          !Array.isArray(o[key]) ||
          o[key].length !== 3 ||
          o[key].some(
            (v) =>
              !Number.isFinite(v) ||
              (key === "size" ? v < 0.01 || v > 20 : Math.abs(v) > 100),
          )
        )
          fail("Medidas o posición no válidas.");
      if (!Number.isFinite(o.rotation) || Math.abs(o.rotation) > 360)
        fail("Rotación no válida.");
    }
    for (const g of m.groups) {
      const effect = effectOf(m, g);
      if (
        (effect === "material" && !ids.has(g.material)) ||
        (effect === "visibility" && !ids.has(g.node))
      )
        fail("La pieza vinculada ya no existe.");
    }
    if (publish && !m.objects.length)
      fail("Añade una pieza a tu escena antes de publicar.");
  }
  if (count > 500) fail("Máximo 500 opciones.");
  for (const r of m.rules) {
    if (
      !r ||
      !["requires", "excludes"].includes(r.type) ||
      typeof r.message !== "string" ||
      r.message.length > 200
    )
      fail("Regla no válida.");
    for (const ref of [r.when, r.target])
      if (
        !m.groups
          .find((g) => g.id === ref?.group)
          ?.options.some((o) => o.id === ref.option)
      )
        fail("Referencia de regla no válida.");
  }
  if (m.kind === "model-3d" && m.model && !assetCheck(m.model, "model"))
    fail("Modelo no válido.");
  if (m.kind === "form" && m.groups.some((g) => effectOf(m, g) !== "choice"))
    fail("Una ficha sin imágenes utiliza elecciones sin efecto visual.");
  if (publish) {
    if (m.kind === "form" && !m.groups.length)
      fail("Añade al menos una elección antes de publicar.");
    if (m.kind === "model-3d" && !m.model)
      fail("Sube un modelo GLB antes de publicar.");
    if (
      ["layers-2d", "images-2d"].includes(m.kind) &&
      !m.groups.some((g) => ["layer", "image"].includes(effectOf(m, g)))
    )
      fail("Añade al menos un grupo de capas.");
    if (m.groups.length && !evaluateProduct(m, {}).valid)
      fail("La combinación predeterminada incumple las reglas.");
  }
  return structuredClone(m);
}
export function evaluateProduct(m, selection = {}) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection))
    fail("Selección no válida.");
  if (!m.groups.length) {
    if (
      Object.keys(selection).some((k) => !(m.personalization && k === "$print"))
    )
      fail("Selección no válida.");
    return {
      valid: true,
      selection: m.personalization
        ? {
            $print: resolvePrint(m, selection),
          }
        : {},
      total: m.basePrice,
      currency: m.currency,
      layers: [],
      errors: [],
    };
  }
  let result;
  try {
    result = evaluate(m, selection);
  } catch {
    fail("Configuración no válida.");
  }
  if (!result.valid) fail(result.errors.join(" "));
  return result;
}
