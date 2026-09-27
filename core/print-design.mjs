/** Portable, bounded print document. No HTML, remote URLs or executable SVG. */
export const blankPrint = () => ({ version: 1, layers: [] });
export function validatePrint(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.layers) ||
    value.layers.length > 20
  )
    throw Error("El diseño admite hasta 20 elementos.");
  const ids = new Set();
  let bytes = 0;
  const layers = value.layers.map((l) => {
    if (
      !l ||
      typeof l.id !== "string" ||
      !/^[a-z0-9_-]{1,60}$/.test(l.id) ||
      ids.has(l.id) ||
      !["front", "back"].includes(l.side) ||
      !["text", "image"].includes(l.type)
    )
      throw Error("Elemento de impresión no válido.");
    ids.add(l.id);
    if (
      ![l.x, l.y, l.width, l.rotation].every(Number.isFinite) ||
      l.x < 0 ||
      l.x > 1 ||
      l.y < 0 ||
      l.y > 1 ||
      l.width < 0.08 ||
      l.width > 0.95 ||
      Math.abs(l.rotation) > 180
    )
      throw Error("Coloca el diseño dentro de su zona.");
    const item = {
      id: l.id,
      side: l.side,
      type: l.type,
      x: l.x,
      y: l.y,
      width: l.width,
      rotation: l.rotation,
    };
    if (l.type === "text") {
      if (
        typeof l.text !== "string" ||
        l.text.length > 100 ||
        typeof l.color !== "string" ||
        !/^#[a-f0-9]{6}$/i.test(l.color) ||
        !["sans", "serif", "mono"].includes(l.font)
      )
        throw Error("Texto de impresión no válido.");
      return { ...item, text: l.text, color: l.color, font: l.font };
    }
    // PNG signature and IHDR dimensions; clients rasterize uploads, never store SVG/HTML.
    if (
      typeof l.src !== "string" ||
      !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(l.src) ||
      l.src.length > 240000
    )
      throw Error("La imagen debe ser un PNG optimizado de hasta 180 KB.");
    const header = atob(l.src.slice(22, 22 + 48));
    const uint = (i) =>
      header.charCodeAt(i) * 16777216 +
      (header.charCodeAt(i + 1) << 16) +
      (header.charCodeAt(i + 2) << 8) +
      header.charCodeAt(i + 3);
    if (
      header.slice(12, 16) !== "IHDR" ||
      uint(16) < 1 ||
      uint(20) < 1 ||
      uint(16) > 1024 ||
      uint(20) > 1024
    )
      throw Error("Dimensiones de imagen no válidas.");
    bytes += l.src.length;
    if (bytes > 600000)
      throw Error(
        "El diseño contiene demasiadas imágenes. Elimina alguna antes de continuar.",
      );
    let original;
    if (l.original !== undefined) {
      const o = l.original;
      if (
        !o ||
        !/^[a-f0-9]{64}$/.test(o.ref) ||
        ![o.width, o.height].every(
          (n) => Number.isSafeInteger(n) && n > 0 && n <= 40000000,
        ) ||
        o.width * o.height > 40000000
      )
        throw Error("Referencia de original no válida.");
      original = { ref: o.ref, width: o.width, height: o.height };
    }
    return { ...item, src: l.src, ...(original ? { original } : {}) };
  });
  return { version: 1, layers };
}

// Remove only our retired starter copy. Preserve customer artwork and older snapshots.
export function resolvePrint(manifest, selection = {}) {
  const design = validatePrint(
    selection.$print ?? manifest.personalization.design,
  );
  if (manifest.personalization.cleanStart)
    design.layers = design.layers.filter(
      (l) =>
        !(
          l.id === "studio_text" &&
          l.type === "text" &&
          ["GROW YOUR WAY.", "MAKE IT YOURS."].includes(
            l.text.replace(/\s+/g, " ").trim(),
          )
        ),
    );
  return design;
}
