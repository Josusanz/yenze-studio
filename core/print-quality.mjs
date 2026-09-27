/** Millimetres are explicit production settings, independent from the display model. */
export function printZone(personalization) {
  const zone = personalization?.printZone ?? {
    widthMm: 285,
    heightMm: 380,
    dpi: 300,
  };
  if (
    !zone ||
    !Number.isFinite(zone.widthMm) ||
    !Number.isFinite(zone.heightMm) ||
    zone.widthMm < 20 ||
    zone.widthMm > 500 ||
    zone.heightMm < 20 ||
    zone.heightMm > 700 ||
    ![150, 300].includes(zone.dpi) ||
    Math.abs(zone.widthMm / zone.heightMm - 0.75) > 0.001
  )
    throw Error(
      "La zona de impresión debe mantener la proporción 3:4, entre 20 y 500 mm de ancho, a 150 o 300 ppp.",
    );
  return { widthMm: zone.widthMm, heightMm: zone.heightMm, dpi: zone.dpi };
}
export function pngDimensions(src) {
  const h = atob(src.slice(22, 70));
  const n = (i) =>
    h.charCodeAt(i) * 16777216 +
    (h.charCodeAt(i + 1) << 16) +
    (h.charCodeAt(i + 2) << 8) +
    h.charCodeAt(i + 3);
  return { width: n(16), height: n(20) };
}
export function printQuality(design, personalization) {
  const zone = printZone(personalization);
  const issues = [];
  for (const l of design.layers) {
    if (l.type === "text") {
      if (!l.text.trim())
        issues.push({
          id: l.id,
          code: "empty",
          message: "Hay un texto vacío. Elimínalo o escribe tu mensaje.",
        });
      continue;
    }
    const dimensions = l.original ?? pngDimensions(l.src);
    const dpi = Math.floor(
      dimensions.width / ((l.width * zone.widthMm) / 25.4),
    );
    const height =
      (l.width * zone.widthMm * dimensions.height) /
      dimensions.width /
      zone.heightMm;
    const angle = (l.rotation * Math.PI) / 180;
    const halfW =
      (Math.abs(Math.cos(angle)) * l.width * zone.widthMm +
        Math.abs(Math.sin(angle)) * height * zone.heightMm) /
      zone.widthMm /
      2;
    const halfH =
      (Math.abs(Math.sin(angle)) * l.width * zone.widthMm +
        Math.abs(Math.cos(angle)) * height * zone.heightMm) /
      zone.heightMm /
      2;
    if (
      l.x - halfW < -0.001 ||
      l.x + halfW > 1.001 ||
      l.y - halfH < -0.001 ||
      l.y + halfH > 1.001
    )
      issues.push({
        id: l.id,
        code: "clipped",
        message: "Parte de una imagen queda fuera de la zona y se recortará.",
      });
    if (!l.original)
      issues.push({
        id: l.id,
        code: "original",
        message:
          "Esta imagen solo conserva la vista previa. Vuelve a subir el original.",
      });
    if (dpi < zone.dpi)
      issues.push({
        id: l.id,
        code: "resolution",
        dpi,
        message: `Una imagen tiene ${dpi} ppp al tamaño elegido; se recomiendan ${zone.dpi} ppp. Reduce su tamaño o sube una imagen mayor.`,
      });
  }
  return {
    zone,
    issues,
    widthPx: Math.round((zone.widthMm / 25.4) * zone.dpi),
    heightPx: Math.round((zone.heightMm / 25.4) * zone.dpi),
  };
}
