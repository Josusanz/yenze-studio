import { resolvePrint } from "./print-design.mjs";
/** Portable 2D import plan. No uploads, network, database or image modification. */
const idPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const label = (value) =>
  value.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
const money = (n) => Number.isSafeInteger(n) && n >= 0;

export function planLayers(
  files,
  { name = "Nuevo configurador", basePrice = 0, currency = "EUR" } = {},
) {
  if (!Array.isArray(files) || !files.length || files.length > 500)
    throw Error("Importa entre 1 y 500 imágenes.");
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 120 ||
    !money(basePrice) ||
    !/^[A-Z]{3}$/.test(currency)
  )
    throw Error("Metadatos del producto no válidos.");
  const groups = new Map(),
    seen = new Set(),
    orders = new Set(),
    views = new Set();
  let canvas;
  for (const file of files) {
    if (!file || typeof file.path !== "string" || file.path.includes("\\"))
      throw Error("Ruta no válida.");
    // Relative to the chosen product folder. Every option contains one image per view.
    const match =
      /^(\d{2})_([a-z0-9][a-z0-9_-]{0,79})\/([a-z0-9][a-z0-9_-]{0,79})\/([a-z0-9][a-z0-9_-]{0,79})\.(png|webp)$/i.exec(
        file.path,
      );
    if (!match)
      throw Error(
        `Ruta no reconocida: ${file.path}. Usa 01_grupo/opcion/frontal.png.`,
      );
    const [, orderText, rawGroup, rawOption, rawView] = match;
    const groupId = rawGroup.toLowerCase(),
      optionId = rawOption.toLowerCase(),
      view = rawView.toLowerCase(),
      order = Number(orderText);
    if (
      ![file.width, file.height].every(
        (n) => Number.isInteger(n) && n > 0 && n <= 8192,
      )
    )
      throw Error(`Dimensiones no válidas: ${file.path}`);
    canvas ??= { width: file.width, height: file.height };
    if (file.width !== canvas.width || file.height !== canvas.height)
      throw Error(
        "Todas las capas deben compartir las dimensiones del lienzo.",
      );
    const key = `${groupId}/${optionId}/${view}`;
    if (seen.has(key)) throw Error(`Vista duplicada: ${key}`);
    seen.add(key);
    views.add(view);
    let group = groups.get(groupId);
    if (!group) {
      if (orders.has(order))
        throw Error(`Orden de capa repetido: ${orderText}`);
      orders.add(order);
      group = {
        id: groupId,
        label: label(groupId),
        order,
        required: true,
        options: [],
      };
      groups.set(groupId, group);
    } else if (group.order !== order)
      throw Error(`El grupo ${groupId} tiene dos órdenes.`);
    let option = group.options.find((o) => o.id === optionId);
    if (!option) {
      option = {
        id: optionId,
        label: label(optionId),
        priceDelta: 0,
        assets: {},
      };
      group.options.push(option);
    }
    option.assets[view] = file.path;
  }
  const sortedViews = [...views].sort(),
    sortedGroups = [...groups.values()].sort((a, b) => a.order - b.order);
  for (const group of sortedGroups) {
    group.options.sort((a, b) => a.id.localeCompare(b.id, "en"));
    group.default = group.options[0].id;
    for (const option of group.options)
      for (const view of sortedViews) {
        if (!Object.hasOwn(option.assets, view))
          throw Error(`Falta la vista ${view} en ${group.id}/${option.id}.`);
      }
  }
  return {
    schemaVersion: 1,
    kind: "layers-2d",
    name: name.trim(),
    currency,
    basePrice,
    canvas,
    views: sortedViews,
    groups: sortedGroups,
    rules: [],
    importWarnings: [
      "Revisa los nombres, el orden y las opciones predeterminadas antes de publicar.",
      "Los suplementos están a cero: define y revisa los precios.",
      "La alineación, transparencia y derechos de las imágenes requieren revisión visual.",
    ],
  };
}

/** Parent references are independent of display/layer order. Reject cycles before evaluating. */
export function hierarchy(groups) {
  const byId = new Map(groups.map((g) => [g.id, g])),
    visiting = new Set(),
    done = new Set(),
    ordered = [];
  function visit(g, depth = 0) {
    if (depth > 12) throw Error("Máximo 12 niveles de opciones.");
    if (visiting.has(g.id))
      throw Error(
        "Una opción no puede depender de sí misma ni de sus descendientes.",
      );
    if (done.has(g.id)) return;
    visiting.add(g.id);
    if (g.parent) {
      const p = byId.get(g.parent.group);
      if (
        !p ||
        p.id === g.id ||
        (g.parent.option != null &&
          !p.options.some((o) => o.id === g.parent.option))
      )
        throw Error("La opción padre no existe.");
      visit(p, depth + 1);
    }
    visiting.delete(g.id);
    done.add(g.id);
    ordered.push(g);
  }
  for (const g of groups) visit(g);
  // Validate actual depth even when ancestors were visited earlier.
  for (const g of groups) {
    let p = g,
      n = 0;
    while (p.parent) {
      if (++n > 12) throw Error("Máximo 12 niveles de opciones.");
      p = byId.get(p.parent.group);
    }
  }
  return ordered;
}
export function effectOf(manifest, g) {
  return (
    g.effect ||
    (manifest.kind === "model-3d" || manifest.kind === "scene-3d"
      ? "material"
      : manifest.kind === "images-2d"
        ? "image"
        : "layer")
  );
}
/** Shared deterministic evaluator. Hidden branches never contribute price, assets or selections. */
export function evaluate(manifest, selection = {}) {
  if (
    manifest?.schemaVersion !== 1 ||
    !["layers-2d", "images-2d", "model-3d", "scene-3d", "form"].includes(
      manifest.kind,
    ) ||
    !money(manifest.basePrice) ||
    !Array.isArray(manifest.groups) ||
    !Array.isArray(manifest.views) ||
    !manifest.views.length
  )
    throw Error("Manifiesto no válido.");
  if (!selection || typeof selection !== "object" || Array.isArray(selection))
    throw Error("Selección no válida.");
  const groupIds = new Set(),
    active = {},
    layers = [],
    errors = [],
    visibleGroups = [];
  let total = manifest.basePrice;
  for (const g of manifest.groups) {
    if (
      !g ||
      typeof g.id !== "string" ||
      !idPattern.test(g.id) ||
      groupIds.has(g.id) ||
      !Array.isArray(g.options) ||
      !g.options.length ||
      !Number.isInteger(g.order) ||
      typeof g.required !== "boolean"
    )
      throw Error("Grupo no válido.");
    groupIds.add(g.id);
    const ids = new Set();
    for (const o of g.options) {
      if (
        !o ||
        typeof o.id !== "string" ||
        !idPattern.test(o.id) ||
        ids.has(o.id) ||
        !money(o.priceDelta)
      )
        throw Error("Opción no válida.");
      ids.add(o.id);
    }
    if (!ids.has(g.default)) throw Error("Opción predeterminada no válida.");
  }
  for (const g of hierarchy(manifest.groups)) {
    if (
      g.parent &&
      (!Object.hasOwn(active, g.parent.group) ||
        active[g.parent.group] === null ||
        (g.parent.option != null && active[g.parent.group] !== g.parent.option))
    )
      continue;
    visibleGroups.push(g.id);
    const value = Object.hasOwn(selection, g.id) ? selection[g.id] : g.default;
    if (value === null && !g.required) {
      active[g.id] = null;
      continue;
    }
    const o = g.options.find((o) => o.id === value);
    if (!o) {
      errors.push("Opción no válida para " + g.label + ".");
      continue;
    }
    active[g.id] = value;
    total += o.priceDelta;
    if (!Number.isSafeInteger(total)) throw Error("Precio fuera de rango.");
    const effect = effectOf(manifest, g);
    if (["layer", "image"].includes(effect)) {
      if (manifest.views.some((v) => typeof o.assets?.[v] !== "string"))
        errors.push("Añade una imagen a " + g.label + " · " + o.label + ".");
      else
        layers.push({
          group: g.id,
          option: value,
          order: g.order,
          assets: o.assets,
          effect,
        });
    }
  }
  for (const key of Object.keys(selection))
    if (!groupIds.has(key) && !(manifest.personalization && key === "$print"))
      errors.push("Grupo desconocido: " + key + ".");
  for (const rule of manifest.rules ?? []) {
    if (!["requires", "excludes"].includes(rule.type))
      throw Error("Regla no válida.");
    for (const ref of [rule.when, rule.target])
      if (
        !manifest.groups
          .find((g) => g.id === ref?.group)
          ?.options.some((o) => o.id === ref.option)
      )
        throw Error("Referencia de regla no válida.");
    if (active[rule.when.group] !== rule.when.option) continue;
    const matches = active[rule.target.group] === rule.target.option;
    if (rule.type === "requires" ? !matches : matches)
      errors.push(rule.message || "Esta combinación no está disponible.");
  }
  const sorted = layers.sort((a, b) => a.order - b.order),
    lastImage = sorted.findLastIndex((l) => l.effect === "image");
  return {
    valid: !errors.length,
    selection: manifest.personalization
      ? {
          ...active,
          $print: resolvePrint(manifest, selection),
        }
      : active,
    visibleGroups,
    layers: lastImage < 0 ? sorted : sorted.slice(lastImage),
    currency: manifest.currency,
    total: errors.length ? null : total,
    errors,
  };
}
