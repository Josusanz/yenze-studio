import sharp from "sharp";
import { fail } from "./validation.mjs";
import { parseAsset } from "./assets.mjs";
const endpoint = "https://api.meshy.ai/openapi/v1/multi-image-to-3d";
export function generations({
  db,
  uid,
  now,
  storeAsset,
  audit,
  key,
  allowed = [],
  request = fetch,
}) {
  const active = new Set();
  const enabled = (org) => !!key && allowed.includes(org);
  const row = (org, id) => {
    const r = db
      .prepare("SELECT * FROM generations WHERE id=? AND org_id=?")
      .get(id, org);
    if (!r) fail("Generación no encontrada.", 404);
    return r;
  };
  async function provider(url, options = {}) {
    let r;
    try {
      r = await request(url, {
        ...options,
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(45000),
        redirect: "error",
      });
    } catch {
      fail(
        "No se pudo confirmar la respuesta de Meshy. No se reintentará el cargo automáticamente.",
        502,
      );
    }
    if (!r.ok)
      fail(
        "Meshy no pudo completar la petición (HTTP " +
          r.status +
          "). Revisa tu cuenta de proveedor.",
        502,
      );
    return r.json();
  }
  async function create(org, actor, b) {
    if (!enabled(org))
      fail("La generación 3D no está habilitada para esta empresa.", 503);
    if (
      typeof b.requestKey !== "string" ||
      !/^[a-f0-9-]{36}$/.test(b.requestKey) ||
      b.consent !== true
    )
      fail("Confirma el envío de las fotos y el uso de créditos.");
    const old = db
      .prepare("SELECT * FROM generations WHERE org_id=? AND request_key=?")
      .get(org, b.requestKey);
    if (old) return old;
    if (!Array.isArray(b.assets) || b.assets.length < 1 || b.assets.length > 4)
      fail("Elige entre una y cuatro fotos del mismo producto.");
    const images = [];
    for (const id of b.assets) {
      const asset = db
        .prepare("SELECT * FROM assets WHERE id=? AND org_id=?")
        .get(id, org);
      if (!asset || asset.mime !== "image/webp")
        fail("Foto no válida. Usa fotos subidas por esta empresa.");
      const bytes = await sharp(asset.bytes)
        .resize({
          width: 1536,
          height: 1536,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 90 })
        .toBuffer();
      images.push("data:image/jpeg;base64," + bytes.toString("base64"));
    }
    const again = db
      .prepare("SELECT * FROM generations WHERE org_id=? AND request_key=?")
      .get(org, b.requestKey);
    if (again) return again;
    const since = new Date(Date.now() - 86400000).toISOString();
    if (
      db
        .prepare(
          "SELECT count(*) n FROM generations WHERE org_id=? AND created>?",
        )
        .get(org, since).n >= 3
    )
      fail("Límite de tres generaciones por empresa cada 24 horas.", 429);
    const id = uid();
    db.prepare(
      "INSERT INTO generations(id,org_id,request_key,status,created) VALUES(?,?,?,?,?)",
    ).run(id, org, b.requestKey, "SUBMITTING", now());
    try {
      const r = await provider(endpoint, {
        method: "POST",
        body: JSON.stringify({
          image_urls: images,
          ai_model: "meshy-7.1",
          should_texture: true,
          enable_pbr: true,
          should_remesh: true,
          target_polycount: 30000,
          target_formats: ["glb"],
        }),
      });
      if (
        typeof r.result !== "string" ||
        !/^[a-zA-Z0-9-]{1,100}$/.test(r.result)
      )
        fail("Respuesta de generación no válida.", 502);
      db.prepare(
        "UPDATE generations SET provider_id=?,status=? WHERE id=?",
      ).run(r.result, "PENDING", id);
      audit(org, actor, "generation.created", id);
      return row(org, id);
    } catch (e) {
      db.prepare("UPDATE generations SET status=? WHERE id=?").run(
        "UNCONFIRMED",
        id,
      );
      throw e;
    }
  }
  async function retrieve(org, id) {
    const r = row(org, id);
    if (!enabled(org)) fail("Proveedor no disponible para esta empresa.", 503);
    if (!r.provider_id || r.asset_id) return { stored: r, remote: null };
    const remote = await provider(
      endpoint + "/" + encodeURIComponent(r.provider_id),
    );
    if (
      !["PENDING", "IN_PROGRESS", "SUCCEEDED", "FAILED", "CANCELED"].includes(
        remote.status,
      )
    )
      fail("Estado del proveedor no reconocido.", 502);
    db.prepare("UPDATE generations SET status=?,progress=? WHERE id=?").run(
      remote.status,
      Math.max(0, Math.min(100, Number(remote.progress) || 0)),
      id,
    );
    return { stored: row(org, id), remote };
  }
  async function get(org, id) {
    const { stored, remote } = await retrieve(org, id);
    return {
      ...stored,
      error:
        remote?.status === "FAILED"
          ? "Meshy no pudo generar este modelo. Revisa las fotos."
          : null,
    };
  }
  async function importModel(org, actor, id) {
    if (active.has(id)) fail("El modelo se está importando.", 409);
    active.add(id);
    try {
      const { stored, remote } = await retrieve(org, id);
      if (stored.asset_id) {
        const a = db
          .prepare("SELECT id,meta FROM assets WHERE id=? AND org_id=?")
          .get(stored.asset_id, org);
        return { id: a.id, ...JSON.parse(a.meta) };
      }
      if (remote?.status !== "SUCCEEDED")
        fail("El modelo todavía no está listo.", 409);
      let url;
      try {
        url = new URL(remote.model_urls?.glb);
      } catch {
        fail("El proveedor no devolvió un GLB.", 502);
      }
      if (
        url.protocol !== "https:" ||
        url.hostname !== "assets.meshy.ai" ||
        url.username ||
        url.password ||
        url.port
      )
        fail("Origen del modelo no permitido.", 502);
      const response = await request(url.href, {
        redirect: "error",
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok || !response.body)
        fail("No se pudo descargar el modelo.", 502);
      const chunks = [];
      let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > 20 * 1024 * 1024)
          fail("El modelo supera 20 MB. Optimízalo antes de subirlo.", 413);
        chunks.push(chunk);
      }
      const parsed = await parseAsset(Buffer.concat(chunks), "generated.glb");
      const usage = db
        .prepare(
          "SELECT coalesce(sum(length(bytes)),0) n FROM assets WHERE org_id=?",
        )
        .get(org).n;
      if (usage + parsed.bytes.length > 250 * 1024 * 1024)
        fail("No queda espacio para el modelo.", 413);
      const asset = storeAsset(
        org,
        parsed.bytes,
        parsed.mime,
        "generated.glb",
        parsed.meta,
      );
      db.prepare("UPDATE generations SET asset_id=? WHERE id=?").run(asset, id);
      audit(org, actor, "generation.imported", id);
      return { id: asset, ...parsed.meta };
    } finally {
      active.delete(id);
    }
  }
  return { enabled, create, get, importModel };
}
