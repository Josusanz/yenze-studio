import { pngResolution } from "../core/png-resolution.mjs";
import { printCanvas } from "./print-canvas";
export async function downloadProduction(orderId: string, side: string) {
  const response = await fetch(`/api/orders/${orderId}/production-file`);
  const packet = await response.json();
  if (!response.ok) throw Error(packet.error || "No se pudo abrir el pedido.");
  if (!packet.design) throw Error("Este pedido no contiene un diseño textil.");
  const design = {
    ...packet.design,
    layers: packet.design.layers.map((l: any) => {
      if (l.type !== "image" || !l.original) return l;
      const a = packet.originals.find((a: any) => a.ref === l.original.ref);
      if (!a)
        throw Error(
          "Falta un original. Descarga la ficha y contacta con el comercio.",
        );
      return { ...l, src: `data:${a.mime};base64,${a.base64}` };
    }),
  };
  const canvas = await printCanvas(
    design,
    side,
    packet.quality.widthPx,
    packet.quality.heightPx,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("No se pudo generar el PNG."))),
      "image/png",
    ),
  );
  const resolved = new Blob(
    [pngResolution(await blob.arrayBuffer(), packet.quality.zone.dpi)],
    { type: "image/png" },
  );
  const url = URL.createObjectURL(resolved),
    a = document.createElement("a");
  a.download = `pedido-${orderId.slice(0, 8)}-${side}-${packet.quality.zone.widthMm}x${packet.quality.zone.heightMm}mm.png`;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
