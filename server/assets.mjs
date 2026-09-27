import sharp from "sharp";
import validator from "gltf-validator";
import { fail } from "./validation.mjs";
const supportedExtensions = new Set([
  "KHR_texture_transform",
  "KHR_mesh_quantization",
  "KHR_materials_unlit",
  "KHR_materials_clearcoat",
  "KHR_materials_sheen",
  "KHR_materials_ior",
  "KHR_materials_specular",
  "KHR_materials_transmission",
  "KHR_materials_volume",
  "KHR_materials_iridescence",
  "KHR_materials_anisotropy",
  "KHR_materials_dispersion",
  "KHR_materials_emissive_strength",
  "EXT_texture_webp",
  "EXT_texture_avif",
]);
export async function parseAsset(bytes, name) {
  let mime, meta;
  if (name.toLowerCase().endsWith(".glb")) {
    if (
      bytes.length < 20 ||
      bytes.toString("ascii", 0, 4) !== "glTF" ||
      bytes.readUInt32LE(4) !== 2 ||
      bytes.readUInt32LE(8) !== bytes.length ||
      bytes.toString("ascii", 16, 20) !== "JSON"
    )
      fail("GLB 2.0 no válido.");
    const size = bytes.readUInt32LE(12);
    let gltf;
    try {
      gltf = JSON.parse(bytes.toString("utf8", 20, 20 + size));
    } catch {
      fail("Modelo no válido.");
    }
    if (!gltf || typeof gltf !== "object") fail("Modelo no válido.");
    for (const field of [
      "buffers",
      "images",
      "materials",
      "meshes",
      "nodes",
      "accessors",
    ])
      if (
        gltf[field] !== undefined &&
        (!Array.isArray(gltf[field]) ||
          gltf[field].some((v) => !v || typeof v !== "object"))
      )
        fail("Estructura GLB no válida.");
    for (const material of gltf.materials || []) {
      const color = material.pbrMetallicRoughness?.baseColorFactor;
      if (
        color &&
        (!Array.isArray(color) ||
          color.length !== 4 ||
          color.some((v) => !Number.isFinite(v) || v < 0 || v > 1))
      )
        fail("Color de material no válido.");
    }
    if (
      [...(gltf.buffers || []), ...(gltf.images || [])].some((v) => v.uri) ||
      (gltf.extensionsRequired &&
        (!Array.isArray(gltf.extensionsRequired) ||
          gltf.extensionsRequired.some((e) => !supportedExtensions.has(e))))
    )
      fail(
        "Usa un GLB autocontenido. Las extensiones de compresión Draco, Meshopt y KTX2 aún no están admitidas.",
      );
    if (
      !gltf ||
      gltf.asset?.version !== "2.0" ||
      !Array.isArray(gltf.meshes) ||
      !gltf.meshes.length ||
      (gltf.nodes?.length || 0) > 5000 ||
      (gltf.accessors || []).some(
        (a) =>
          !Number.isSafeInteger(a.count) || a.count < 0 || a.count > 5000000,
      )
    )
      fail("Geometría GLB no válida o demasiado compleja.");
    let report;
    try {
      report = await validator.validateBytes(new Uint8Array(bytes), {
        format: "glb",
        maxIssues: 100,
      });
    } catch {
      fail(
        "No se puede validar este modelo. Vuelve a exportarlo como GLB 2.0.",
      );
    }
    if (report.issues.numErrors) {
      const issue = report.issues.messages.find((m) => m.severity === 0);
      fail(
        "El modelo contiene geometría o referencias no válidas. Vuelve a exportarlo como GLB 2.0. Detalle: " +
          (issue?.code || "GLB_INVALID"),
      );
    }
    // Normalize unnamed/duplicate materials and nodes so authors can configure unprepared exports.
    const materialNames = new Set();
    for (const [i, m] of (gltf.materials || []).entries()) {
      let n =
        typeof m.name === "string" && m.name.trim()
          ? m.name.trim().slice(0, 100)
          : "Material " + (i + 1);
      if (materialNames.has(n)) n += " " + (i + 1);
      while (materialNames.has(n)) n += "_";
      materialNames.add(n);
      m.name = n;
    }
    const nodeNames = new Set(),
      nodes = [];
    for (const [i, n] of (gltf.nodes || []).entries()) {
      const label = String(n.name || "Pieza " + (i + 1)).slice(0, 100);
      let name = label.replace(/[^a-zA-Z0-9_-]/g, "_");
      if (nodeNames.has(name)) name += "_" + i;
      while (nodeNames.has(name)) name += "_";
      nodeNames.add(name);
      n.name = name;
      if (n.mesh !== undefined) nodes.push({ name, label, mesh: n.mesh });
    }
    const activeMaterials = new Set(
      gltf.meshes.flatMap((m) => (m.primitives || []).map((p) => p.material)),
    );
    const names = (gltf.materials || [])
      .filter((m, i) => activeMaterials.has(i))
      .map((m) => m.name);
    const json = Buffer.from(JSON.stringify(gltf)),
      padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
    json.copy(padded);
    const rest = bytes.subarray(20 + size),
      normalized = Buffer.alloc(20 + padded.length + rest.length);
    bytes.copy(normalized, 0, 0, 12);
    normalized.writeUInt32LE(normalized.length, 8);
    normalized.writeUInt32LE(padded.length, 12);
    normalized.write("JSON", 16);
    padded.copy(normalized, 20);
    rest.copy(normalized, 20 + padded.length);
    bytes = normalized;
    mime = "model/gltf-binary";
    meta = {
      materials: names,
      nodes,
      triangles: Math.round(
        (gltf.meshes || []).reduce(
          (n, m) =>
            n +
            (m.primitives || []).reduce(
              (s, p) =>
                s +
                ((gltf.accessors || [])[p.indices ?? p.attributes?.POSITION]
                  ?.count || 0) /
                  3,
              0,
            ),
          0,
        ),
      ),
      colors: Object.fromEntries(
        (gltf.materials || []).map((m) => [
          m.name,
          "#" +
            (m.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1])
              .slice(0, 3)
              .map((v) =>
                Math.round(
                  255 *
                    (v <= 0.0031308
                      ? v * 12.92
                      : 1.055 * Math.pow(v, 1 / 2.4) - 0.055),
                )
                  .toString(16)
                  .padStart(2, "0"),
              )
              .join(""),
        ]),
      ),
    };
  } else {
    try {
      const image = sharp(bytes, {
          limitInputPixels: 32_000_000,
          animated: false,
        }),
        info = await image.metadata();
      if (
        !["png", "webp", "jpeg"].includes(info.format) ||
        info.pages > 1 ||
        info.width > 8192 ||
        info.height > 8192
      )
        fail("Usa PNG, WebP o JPEG hasta 8192 px.");
      bytes = await image.rotate().webp({ lossless: true }).toBuffer();
      const decoded = await sharp(bytes).metadata();
      meta = {
        width: decoded.width,
        height: decoded.height,
        alpha: !!decoded.hasAlpha,
      };
      mime = "image/webp";
    } catch (e) {
      if (e.status) throw e;
      fail("No se ha podido leer esta imagen.");
    }
  }

  return { bytes, mime, meta };
}
