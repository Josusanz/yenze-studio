/** Add physical resolution metadata to browser PNG exports without changing pixels. */
export function pngResolution(input, dpi) {
  const bytes = new Uint8Array(input);
  if (
    bytes.length < 33 ||
    bytes[0] !== 137 ||
    String.fromCharCode(...bytes.slice(1, 4)) !== "PNG" ||
    ![150, 300].includes(dpi)
  )
    throw Error("PNG o resolución no válidos.");
  const chunk = new Uint8Array(21),
    view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  const ppm = Math.round(dpi / 0.0254);
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1;
  let crc = 0xffffffff;
  for (const b of chunk.slice(4, 17)) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const pieces = [bytes.slice(0, 33), chunk];
  let pos = 33;
  while (pos < bytes.length) {
    if (pos + 12 > bytes.length) throw Error("PNG incompleto.");
    const length = new DataView(
      bytes.buffer,
      bytes.byteOffset + pos,
      4,
    ).getUint32(0);
    const end = pos + 12 + length;
    if (end > bytes.length) throw Error("PNG incompleto.");
    if (String.fromCharCode(...bytes.slice(pos + 4, pos + 8)) !== "pHYs")
      pieces.push(bytes.slice(pos, end));
    pos = end;
  }
  const output = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of pieces) {
    output.set(p, at);
    at += p.length;
  }
  return output;
}
