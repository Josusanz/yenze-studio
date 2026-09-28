import sharp from "sharp";
import { randomBytes, createHash } from "node:crypto";
import { fail } from "./validation.mjs";
import { resolvePrint } from "../core/print-design.mjs";
import { printQuality } from "../core/print-quality.mjs";
export async function printAssets(db) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS print_assets(ref TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), org_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, sha256 TEXT NOT NULL, created TEXT NOT NULL);`,
  );
  async function check(productId, design) {
    for (const l of design?.layers ?? [])
      if (l.original) {
        const a = await db
          .prepare(
            "SELECT width,height FROM print_assets WHERE ref=? AND product_id=?",
          )
          .get(l.original.ref, productId);
        if (
          !a ||
          a.width !== l.original.width ||
          a.height !== l.original.height
        )
          fail(
            "El original no pertenece a este producto o ha cambiado. Vuelve a subirlo.",
          );
      }
  }
  async function upload(p, b) {
    if (
      typeof b.data !== "string" ||
      b.data.length > 14 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(b.data)
    )
      fail("Sube una imagen PNG, JPG o WebP de hasta 10 MB.");
    const bytes = Buffer.from(b.data, "base64");
    if (bytes.length > (process.env.VERCEL ? 3 : 10) * 1024 * 1024)
      fail(
        process.env.VERCEL
          ? "Máximo 3 MB por original en la beta online."
          : "Máximo 10 MB por original.",
        413,
      );
    let meta;
    try {
      meta = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
    } catch {
      fail("Imagen no válida o mayor de 40 megapíxeles.");
    }
    if (!["png", "jpeg", "webp"].includes(meta.format) || (meta.pages ?? 1) > 1)
      fail("Usa una imagen estática PNG, JPG o WebP.");
    // Fully decode before retaining the uploaded original. Orientation is handled by the browser preview.
    try {
      await sharp(bytes, { limitInputPixels: 40000000 }).stats();
    } catch {
      fail("El archivo de imagen está incompleto.");
    }
    const rotated = [5, 6, 7, 8].includes(meta.orientation),
      width = rotated ? meta.height : meta.width,
      height = rotated ? meta.width : meta.height;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    // Deduplication is product-scoped; the capability never grants access to another product.
    const old = await db
      .prepare(
        "SELECT ref,width,height FROM print_assets WHERE product_id=? AND sha256=?",
      )
      .get(p.id, sha256);
    if (old) return { original: old };
    const ref = randomBytes(32).toString("hex");
    await db.exec("BEGIN IMMEDIATE");
    try {
      const usage = (
        await db
          .prepare(
            "SELECT coalesce(sum(length(bytes)),0) n FROM print_assets WHERE org_id=?",
          )
          .get(p.org_id)
      ).n;
      if (usage + bytes.length > 250 * 1024 * 1024)
        fail(
          "El almacenamiento de originales de este comercio está lleno.",
          413,
        );
      await db
        .prepare("INSERT INTO print_assets VALUES(?,?,?,?,?,?,?,?,?,?)")
        .run(
          ref,
          p.id,
          p.org_id,
          String(b.name || "imagen").slice(0, 120),
          `image/${meta.format === "jpeg" ? "jpeg" : meta.format}`,
          bytes,
          width,
          height,
          sha256,
          new Date().toISOString(),
        );
      await db.exec("COMMIT");
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
    return { original: { ref, width, height } };
  }
  async function packet(order, configuration, proof, includeOriginals = false) {
    const manifest = JSON.parse(configuration.manifest),
      selection = JSON.parse(configuration.selection);
    const design = manifest.personalization
      ? resolvePrint(manifest, selection)
      : null;
    if (design) await check(configuration.product_id, design);
    const originals = [];
    for (const ref of new Set(
      (includeOriginals ? (design?.layers ?? []) : [])
        .map((l) => l.original?.ref)
        .filter(Boolean),
    )) {
      const a = await db
        .prepare("SELECT * FROM print_assets WHERE ref=? AND product_id=?")
        .get(ref, configuration.product_id);
      originals.push({
        ref,
        name: a.name,
        mime: a.mime,
        width: a.width,
        height: a.height,
        sha256: a.sha256,
        base64: Buffer.from(a.bytes).toString("base64"),
      });
    }
    return {
      schemaVersion: 1,
      orderId: order.id,
      productVersion: configuration.version,
      amount: order.amount,
      currency: manifest.currency,
      product: manifest.name,
      selection,
      choices: manifest.groups
        .filter(
          (g) => Object.hasOwn(selection, g.id) && selection[g.id] !== null,
        )
        .map((g) => ({
          question: g.label,
          answer: g.options.find((o) => o.id === selection[g.id])?.label,
        })),
      design,
      quality: design ? printQuality(design, manifest.personalization) : null,
      proof,
      originals,
      instructions:
        "Originales intactos y coordenadas normalizadas sobre la zona en milímetros. Revisar tipografías, recortes y color con el taller antes de fabricar. No es un PDF/X ni una certificación de impresión.",
    };
  }
  async function clone(sourceId, targetId, org, design) {
    await check(sourceId, design);
    const refs = new Map();
    for (const l of design?.layers ?? [])
      if (l.original) {
        if (!refs.has(l.original.ref)) {
          const a = await db
            .prepare("SELECT * FROM print_assets WHERE ref=? AND product_id=?")
            .get(l.original.ref, sourceId);
          const usage = (
            await db
              .prepare(
                "SELECT coalesce(sum(length(bytes)),0) n FROM print_assets WHERE org_id=?",
              )
              .get(org)
          ).n;
          if (usage + a.bytes.length > 250 * 1024 * 1024)
            fail("No hay espacio para duplicar los originales.", 413);
          const ref = randomBytes(32).toString("hex");
          await db
            .prepare("INSERT INTO print_assets VALUES(?,?,?,?,?,?,?,?,?,?)")
            .run(
              ref,
              targetId,
              org,
              a.name,
              a.mime,
              a.bytes,
              a.width,
              a.height,
              a.sha256,
              new Date().toISOString(),
            );
          refs.set(l.original.ref, ref);
        }
        l.original = { ...l.original, ref: refs.get(l.original.ref) };
      }
  }
  return { upload, check, packet, clone };
}
