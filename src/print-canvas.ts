// Reuse decoded artwork while moving or editing other layers. Keep memory bounded.
const decodedImages = new Map<string, Promise<HTMLImageElement>>();
function printImage(src: string) {
  let image = decodedImages.get(src);
  if (!image) {
    image = (async () => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return img;
    })();
    decodedImages.set(src, image);
    image.catch(() => decodedImages.delete(src));
    if (decodedImages.size > 8)
      decodedImages.delete(decodedImages.keys().next().value!);
  }
  return image;
}
export const fonts: Record<string, string> = {
  sans: "Arial, sans-serif",
  serif: "Georgia, serif",
  mono: "Courier New, monospace",
};
export async function printCanvas(
  design: any,
  side: string,
  width = 768,
  height = 1024,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  for (const layer of design.layers.filter((l: any) => l.side === side)) {
    ctx.save();
    ctx.translate(layer.x * width, layer.y * height);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    const w = layer.width * width;
    if (layer.type === "text") {
      const lines = layer.text.split("\n");
      ctx.font = `700 100px ${fonts[layer.font]}`;
      const widest = Math.max(
        1,
        ...lines.map((s: string) => ctx.measureText(s).width),
      );
      const size = Math.min((w / widest) * 100, (200 * width) / 768);
      ctx.font = `700 ${size}px ${fonts[layer.font]}`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach((s: string, i: number) =>
        ctx.fillText(s, 0, (i - (lines.length - 1) / 2) * size * 1.12),
      );
    } else {
      const img = await printImage(layer.src);
      const h = (w * img.height) / img.width;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }
  return canvas;
}
export async function normalizePrintImage(file: File) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw Error("Sube una imagen PNG, JPG o WebP de hasta 10 MB.");
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
    if (img.width * img.height > 40000000)
      throw Error("La imagen es demasiado grande. Máximo 40 megapíxeles.");
    let size = 768;
    let src = "";
    do {
      const scale = Math.min(1, size / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      src = canvas.toDataURL("image/png");
      size = Math.floor(size * 0.75);
    } while (src.length > 240000 && size >= 96);
    if (src.length > 240000)
      throw Error("No se pudo optimizar esta imagen. Prueba una más sencilla.");
    return src;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function printLayerHeight(layer: any) {
  if (layer.type === "image") {
    const h = atob(layer.src.slice(22, 70));
    const n = (i: number) =>
      h.charCodeAt(i) * 16777216 +
      (h.charCodeAt(i + 1) << 16) +
      (h.charCodeAt(i + 2) << 8) +
      h.charCodeAt(i + 3);
    return (layer.width * 0.75 * n(20)) / n(16);
  }
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = `700 100px ${fonts[layer.font]}`;
  const lines = layer.text.split("\n"),
    widest = Math.max(1, ...lines.map((s: string) => ctx.measureText(s).width));
  const size = Math.min(((layer.width * 768) / widest) * 100, 200);
  return Math.max(0.025, (lines.length * size * 1.12) / 1024);
}
