import { emailVerification } from "./email-verification.mjs";
import { commerce } from "./commerce.mjs";
import { printAssets } from "./print-assets.mjs";
import { orderProofs } from "./order-proofs.mjs";
import { setupGroups, industries } from "../core/industries.mjs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { parseAsset } from "./assets.mjs";
import { generations } from "./generations.mjs";
import { productURLs } from "./product-urls.mjs";
import { openDB } from "./db.mjs";
import { templates, makeTemplate } from "./templates.mjs";
import { fail, text, validManifest, evaluateProduct } from "./validation.mjs";
import { payments } from "./payments.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prod = process.env.NODE_ENV === "production",
  port = Number(process.env.PORT || 3061),
  origin = process.env.APP_ORIGIN || "http://localhost:3060";
if (prod && (!process.env.APP_ORIGIN || !origin.startsWith("https://")))
  throw Error("Configura APP_ORIGIN con HTTPS.");
const db = openDB(process.env.YENZE_DATA_DIR || path.join(root, "data"));
const urls = productURLs(db);
const prints = printAssets(db),
  proofs = orderProofs(db);
const carts = commerce(db, prints);
const verification = emailVerification(db, {
  mail,
  origin,
  enabled: () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM,
});
const requireVerified =
  process.env.REQUIRE_VERIFIED_EMAIL === "true" ||
  (prod && process.env.REQUIRE_VERIFIED_EMAIL !== "false");
const uid = () => randomBytes(16).toString("hex"),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  now = () => new Date().toISOString();
const one = (sql, ...args) => db.prepare(sql).get(...args),
  all = (sql, ...args) => db.prepare(sql).all(...args),
  run = (sql, ...args) => db.prepare(sql).run(...args);
const audit = (org, actor, action, target) =>
  run(
    "INSERT INTO audit(org_id,actor,action,target,created) VALUES(?,?,?,?,?)",
    org,
    actor,
    action,
    target,
    now(),
  );
const pay = payments({
  secret: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  origin,
  db,
  now,
  audit,
});
function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
function reply(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}
async function raw(req, max = 28 * 1024 * 1024) {
  const chunks = [];
  let n = 0;
  for await (const chunk of req) {
    n += chunk.length;
    if (n > max) fail("Archivo demasiado grande.", 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function body(req) {
  try {
    const parsed = JSON.parse(
      (
        await raw(
          req,
          req.url === "/api/assets" ||
            /^\/api\/(public|products)\/[a-f0-9]{32}\/print-assets$/.test(
              req.url,
            )
            ? 28 * 1024 * 1024
            : 1024 * 1024,
        )
      ).toString() || "{}",
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      fail("Se requiere un objeto JSON.");
    return parsed;
  } catch (e) {
    if (e.status) throw e;
    fail("JSON no válido.");
  }
}
const rates = new Map();
function limit(req, key, max = 120) {
  const k = req.socket.remoteAddress + ":" + key,
    t = Date.now();
  let r = rates.get(k);
  if (!r || t - r.at > 600000) r = { at: t, n: 0 };
  if (++r.n > max) fail("Demasiados intentos. Prueba más tarde.", 429);
  rates.set(k, r);
  if (rates.size > 10000)
    for (const [k, v] of rates) if (t - v.at > 600000) rates.delete(k);
}
function userFor(req) {
  const rawCookie = req.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("yenze_session="))
    ?.slice(14);
  if (!rawCookie) return null;
  return one(
    "SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
    hash(rawCookie),
    Date.now(),
  );
}
function setSession(res, id) {
  const token = randomBytes(32).toString("hex");
  run("DELETE FROM sessions WHERE expires<?", Date.now());
  run(
    "INSERT INTO sessions VALUES(?,?,?)",
    hash(token),
    id,
    Date.now() + 7 * 86400000,
  );
  res.setHeader(
    "Set-Cookie",
    `yenze_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${prod ? "; Secure" : ""}`,
  );
}
const memberships = (user) =>
  user
    ? all(
        "SELECT o.id,o.name,o.slug,o.accent,m.role FROM memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=?",
        user.id,
      )
    : [];
function orgPublic(o) {
  return { id: o.id, name: o.name, slug: o.slug, accent: o.accent };
}
function ctx(req, user, scope = "read") {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (bearer) {
    const key = one("SELECT * FROM tokens WHERE token=?", hash(bearer));
    if (!key || !JSON.parse(key.scopes).includes(scope))
      fail("Token sin permiso.", 403);
    return {
      org: one("SELECT * FROM organizations WHERE id=?", key.org_id),
      actor: "token:" + key.id,
      role: "api",
    };
  }
  if (!user) fail("Inicia sesión.", 401);
  const list = memberships(user);
  const selected = req.headers["x-workspace"] || list[0]?.id;
  const member = list.find((m) => m.id === selected);
  if (!member) fail("No tienes acceso a esta empresa.", 403);
  if (scope === "owner" && member.role !== "owner")
    fail("Solo el propietario puede realizar esta acción.", 403);
  return {
    org: one("SELECT * FROM organizations WHERE id=?", member.id),
    actor: user.id,
    role: member.role,
  };
}
const assetCheck = (org) => (id, type, canvas) => {
  if (typeof id !== "string") return false;
  const a = one(
    "SELECT mime,meta FROM assets WHERE id=? AND org_id=?",
    id,
    org,
  );
  return (
    !!a &&
    (type === "image"
      ? a.mime.startsWith("image/") &&
        (!canvas ||
          (JSON.parse(a.meta).width === canvas.width &&
            JSON.parse(a.meta).height === canvas.height))
      : a.mime === "model/gltf-binary")
  );
};
function storeAsset(org, bytes, mime, name, meta = {}) {
  if (
    one(
      "SELECT coalesce(sum(length(bytes)),0) n FROM assets WHERE org_id=?",
      org,
    ).n +
      bytes.length >
    250 * 1024 * 1024
  )
    fail("Límite de 250 MB por empresa.", 413);
  const id = uid();
  run(
    "INSERT INTO assets VALUES(?,?,?,?,?,?,?)",
    id,
    org,
    name,
    mime,
    bytes,
    JSON.stringify(meta),
    now(),
  );
  return id;
}
const generation = generations({
  db,
  uid,
  now,
  storeAsset,
  audit,
  key: process.env.MESHY_API_KEY,
  allowed: (process.env.MESHY_ORGANIZATIONS || "").split(",").filter(Boolean),
});
function product(p) {
  return {
    ...p,
    publicPath: urls.pathFor(p),
    draft: JSON.parse(p.draft),
    active: !!p.active,
  };
}
function getProduct(id, org) {
  const p = one(
    "SELECT * FROM products WHERE id=? AND org_id=? AND deleted_at IS NULL",
    id,
    org,
  );
  if (!p) fail("Producto no encontrado.", 404);
  return p;
}
function orderView(o) {
  const c = one("SELECT * FROM configurations WHERE id=?", o.configuration_id),
    u = one("SELECT name,email FROM users WHERE id=?", o.user_id),
    org = one("SELECT name,slug FROM organizations WHERE id=?", o.org_id);
  return {
    ...o,
    checkout_url: undefined,
    checkout_id: undefined,
    payment_intent: undefined,
    customer: u,
    proof: proofs.current(o.id),
    organization: org,
    configuration: {
      ...c,
      selection: JSON.parse(c.selection),
      manifest: JSON.parse(c.manifest),
    },
    messages: all(
      "SELECT m.id,m.body,m.created,u.name FROM messages m JOIN users u ON u.id=m.user_id WHERE order_id=? ORDER BY m.created",
      o.id,
    ),
  };
}
function orderAccess(req, user, id) {
  if (!user) fail("Inicia sesión.", 401);
  const o = one("SELECT * FROM orders WHERE id=?", id);
  if (!o) fail("Pedido no encontrado.", 404);
  const admin = !!one(
    "SELECT 1 FROM memberships WHERE user_id=? AND org_id=?",
    user.id,
    o.org_id,
  );
  if (!admin && o.user_id !== user.id) fail("Pedido no encontrado.", 404);
  return { o, admin };
}
async function mail(to, subject, html) {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, html }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error("No se pudo enviar el email.");
  return true;
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost"),
      route = url.pathname,
      method = req.method || "GET";
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (route === "/api/stripe/webhook" && method === "POST") {
      reply(
        res,
        pay.webhook(
          await raw(req, 1024 * 1024),
          req.headers["stripe-signature"],
        ),
      );
      return;
    }
    if (!route.startsWith("/api/")) {
      if (!prod) fail("Ruta no encontrada.", 404);
      const dest = path.resolve(root, "dist", "." + decodeURIComponent(route));
      const dir = path.join(root, "dist");
      if (dest !== dir && !dest.startsWith(dir + path.sep))
        fail("Ruta no válida.");
      const file =
        existsSync(dest) && statSync(dest).isFile()
          ? dest
          : path.join(dir, "index.html");
      let ancestors = "'self'";
      const embedProduct =
        url.searchParams.get("product") || urls.resolve(route)?.id;
      if (url.searchParams.has("embed") && embedProduct) {
        const org = one(
          "SELECT o.domains FROM organizations o JOIN products p ON p.org_id=o.id WHERE p.id=? AND p.active=1",
          embedProduct,
        );
        if (org) ancestors += " " + JSON.parse(org.domains).join(" ");
      }
      res.setHeader(
        "Content-Security-Policy",
        `frame-ancestors ${ancestors}; object-src 'none'; base-uri 'self'`,
      );
      res.setHeader(
        "Content-Type",
        {
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".woff2": "font/woff2",
          ".html": "text/html",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(readFileSync(file));
      return;
    }
    if (!["GET", "HEAD"].includes(method)) {
      if (req.headers.origin && req.headers.origin !== origin)
        fail("Origen no permitido.", 403);
      if (!req.headers["content-type"]?.includes("application/json"))
        fail("Se requiere JSON.", 415);
      limit(req, "write", 300);
    }
    const user = userFor(req);
    if (route === "/api/health") {
      reply(res, { ok: true });
      return;
    }
    if (route === "/api/me" && method === "GET") {
      reply(res, {
        user,
        emailVerified: user ? verification.verified(user.id) : false,
        organizations: memberships(user),
        stripeConfigured: pay.configured,
        emailConfigured:
          !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM,
      });
      return;
    }
    if (route === "/api/auth/verify" && method === "POST") {
      limit(req, "verify", 20);
      reply(res, verification.confirm((await body(req)).token));
      return;
    }
    if (route === "/api/auth/verification" && method === "POST") {
      limit(req, "verify-send", 5);
      if (!user) fail("Inicia sesión.", 401);
      reply(res, await verification.send(user));
      return;
    }
    if (route === "/api/auth/logout" && method === "POST") {
      const token = req.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("yenze_session="))
        ?.slice(14);
      if (token) run("DELETE FROM sessions WHERE token=?", hash(token));
      res.setHeader(
        "Set-Cookie",
        "yenze_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      );
      reply(res, { ok: true });
      return;
    }
    if (
      ["/api/auth/signup", "/api/auth/login"].includes(route) &&
      method === "POST"
    ) {
      limit(req, "auth", 30);
      const b = await body(req),
        email = text(b.email, 254).toLowerCase();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof b.password !== "string" ||
        b.password.length < 10 ||
        b.password.length > 128
      )
        fail("Email válido y contraseña de 10 a 128 caracteres.");
      let u = one("SELECT * FROM users WHERE email=?", email);
      if (route.endsWith("signup")) {
        if (u) fail("Ya existe una cuenta con este email.", 409);
        const id = uid(),
          salt = uid(),
          name = text(b.name, 80),
          password =
            salt + ":" + scryptSync(b.password, salt, 64).toString("hex");
        transaction(() => {
          run(
            "INSERT INTO users VALUES(?,?,?,?,?)",
            id,
            email,
            name,
            password,
            now(),
          );
          if (b.company) {
            const org = uid(),
              brand = text(b.company, 80),
              slug =
                brand
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
                  .slice(0, 30) +
                "-" +
                org.slice(0, 6);
            run(
              "INSERT INTO organizations(id,slug,name,created) VALUES(?,?,?,?)",
              org,
              slug,
              brand,
              now(),
            );
            run("INSERT INTO memberships VALUES(?,?,?)", id, org, "owner");
          }
        });
        u = { id, name, email };
      } else {
        const [salt, stored] = (
          u?.password || "dummy:" + "0".repeat(128)
        ).split(":");
        if (
          !timingSafeEqual(
            scryptSync(b.password, salt, 64),
            Buffer.from(stored, "hex"),
          ) ||
          !u
        )
          fail("Email o contraseña incorrectos.", 401);
      }
      setSession(res, u.id);
      reply(res, {
        user: { id: u.id, email: u.email, name: u.name },
        organizations: memberships(u),
      });
      return;
    }
    if (route === "/api/auth/forgot" && method === "POST") {
      limit(req, "forgot", 8);
      const b = await body(req),
        u = one(
          "SELECT * FROM users WHERE email=?",
          String(b.email).trim().toLowerCase(),
        );
      if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
        fail(
          "La recuperación por email no está configurada. Contacta con el administrador.",
          503,
        );
      if (u) {
        const token = randomBytes(32).toString("hex");
        run(
          "INSERT INTO resets VALUES(?,?,?)",
          hash(token),
          u.id,
          Date.now() + 1800000,
        );
        await mail(
          u.email,
          "Recupera tu acceso a Yenze",
          `<p><a href="${origin}/?reset=${token}">Elige una nueva contraseña</a>. El enlace caduca en 30 minutos.</p>`,
        );
      }
      reply(res, { ok: true });
      return;
    }
    if (route === "/api/auth/reset" && method === "POST") {
      limit(req, "reset", 10);
      const b = await body(req),
        r = one(
          "SELECT * FROM resets WHERE token=? AND expires>?",
          hash(String(b.token)),
          Date.now(),
        );
      if (
        !r ||
        typeof b.password !== "string" ||
        b.password.length < 10 ||
        b.password.length > 128
      )
        fail("Enlace inválido o contraseña demasiado corta.");
      const salt = uid();
      transaction(() => {
        run(
          "UPDATE users SET password=? WHERE id=?",
          salt + ":" + scryptSync(b.password, salt, 64).toString("hex"),
          r.user_id,
        );
        run("DELETE FROM resets WHERE user_id=?", r.user_id);
        run("DELETE FROM sessions WHERE user_id=?", r.user_id);
      });
      reply(res, { ok: true });
      return;
    }
    if (route === "/api/templates") {
      reply(
        res,
        templates.map(({ render, ...t }) => t),
      );
      return;
    }
    const assetMatch = route.match(/^\/api\/assets\/([a-f0-9]{32})$/);
    if (assetMatch && method === "GET") {
      const a = one("SELECT * FROM assets WHERE id=?", assetMatch[1]);
      if (!a) fail("Archivo no encontrado.", 404);
      let access = !!(
        user &&
        one(
          "SELECT 1 FROM memberships WHERE user_id=? AND org_id=?",
          user.id,
          a.org_id,
        )
      );
      if (!access)
        access = !!one(
          "SELECT 1 FROM versions WHERE org_id=? AND instr(manifest,?)>0 LIMIT 1",
          a.org_id,
          a.id,
        );
      if (!access) fail("Archivo no encontrado.", 404);
      res.writeHead(200, {
        "Content-Type": a.mime,
        "Cache-Control": access ? "private, max-age=3600" : "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      });
      res.end(a.bytes);
      return;
    }
    const storeMatch = route.match(/^\/api\/store\/([a-z0-9-]+)$/);
    if (storeMatch && method === "GET") {
      const o = one("SELECT * FROM organizations WHERE slug=?", storeMatch[1]);
      if (!o) fail("Tienda no encontrada.", 404);
      const products = all(
        "SELECT p.id,p.org_id,p.name,p.niche,p.mode,p.published,v.manifest FROM products p JOIN versions v ON v.product_id=p.id AND v.revision=p.published WHERE p.org_id=? AND p.active=1",
        o.id,
      ).map((p) => ({
        ...p,
        publicPath: urls.pathFor(p),
        manifest: JSON.parse(p.manifest),
      }));
      reply(res, { organization: orgPublic(o), products });
      return;
    }
    const cartTicket = route.match(
      /^\/api\/public\/([a-f0-9]{32})\/cart-ticket$/,
    );
    if (cartTicket && method === "POST") {
      limit(req, "cart-ticket", 30);
      reply(res, carts.issue(cartTicket[1], await body(req)), 201);
      return;
    }
    const printUpload = route.match(
      /^\/api\/(public|products)\/([a-f0-9]{32})\/print-assets$/,
    );
    if (printUpload && method === "POST") {
      limit(req, "print-upload", 20);
      const p = one(
        "SELECT * FROM products WHERE id=? AND deleted_at IS NULL",
        printUpload[2],
      );
      if (!p) fail("Producto no encontrado.", 404);
      let manifest;
      if (printUpload[1] === "products") {
        const context = ctx(req, user, "write");
        if (context.org.id !== p.org_id) fail("Producto no encontrado.", 404);
        manifest = JSON.parse(p.draft);
      } else {
        if (!p.active) fail("Producto no disponible.", 404);
        manifest = JSON.parse(
          one(
            "SELECT manifest FROM versions WHERE product_id=? AND revision=?",
            p.id,
            p.published,
          ).manifest,
        );
      }
      if (!manifest.personalization)
        fail("Este producto no admite originales de impresión.");
      reply(res, await prints.upload(p, await body(req)), 201);
      return;
    }
    const publicMatch = route.match(
      /^\/api\/public\/([a-f0-9]{32})(?:\/(share))?$/,
    );
    const namedProduct = route.startsWith("/api/catalog/")
      ? urls.resolve("/p/" + route.slice("/api/catalog/".length))
      : null;
    if (route.startsWith("/api/catalog/") && !namedProduct)
      fail("Producto no encontrado.", 404);
    if (
      (publicMatch || namedProduct) &&
      (method === "GET" || (method === "POST" && publicMatch?.[2] === "share"))
    ) {
      const p = one(
        "SELECT * FROM products WHERE id=? AND active=1",
        publicMatch?.[1] || namedProduct.id,
      );
      if (!p) fail("Este configurador no está publicado.", 404);
      const o = one("SELECT * FROM organizations WHERE id=?", p.org_id),
        v = one(
          "SELECT * FROM versions WHERE product_id=? AND revision=?",
          p.id,
          p.published,
        );
      if (method === "POST") {
        limit(req, "share", 60);
        const b = await body(req);
        if (b.version !== p.published)
          fail("El producto ha cambiado. Recarga antes de compartir.", 409);
        const result = evaluateProduct(JSON.parse(v.manifest), b.selection);
        prints.check(p.id, result.selection.$print);
        const selection = JSON.stringify(result.selection);
        let shared = one(
          "SELECT code FROM shared_selections WHERE product_id=? AND version=? AND selection=?",
          p.id,
          p.published,
          selection,
        );
        if (!shared) {
          const sharedBytes = one(
            "SELECT coalesce(sum(length(CAST(selection AS BLOB))),0) bytes FROM shared_selections WHERE product_id=?",
            p.id,
          ).bytes;
          if (sharedBytes + Buffer.byteLength(selection) > 20 * 1024 * 1024)
            fail(
              "Se ha alcanzado el espacio para compartir diseños de este producto. Contacta con el estudio.",
              429,
            );
          if (
            one(
              "SELECT count(*) n FROM shared_selections WHERE product_id=?",
              p.id,
            ).n >= 10000
          )
            fail("Límite de enlaces compartidos alcanzado.", 429);
          const code = randomBytes(12).toString("hex");
          run(
            "INSERT INTO shared_selections VALUES(?,?,?,?,?)",
            code,
            p.id,
            p.published,
            selection,
            now(),
          );
          shared = { code };
        }
        reply(res, { path: urls.pathFor(p) + "?c=" + shared.code });
        return;
      }
      let sharedSelection;
      if (url.searchParams.has("c")) {
        const shared = one(
          "SELECT * FROM shared_selections WHERE code=? AND product_id=?",
          url.searchParams.get("c"),
          p.id,
        );
        if (!shared) fail("Esta combinación compartida no existe.", 404);
        if (shared.version !== p.published)
          fail(
            "El producto ha cambiado desde que se compartió. Abre el enlace del producto sin la combinación para configurarlo de nuevo.",
            409,
          );
        sharedSelection = JSON.parse(shared.selection);
      }
      reply(res, {
        id: p.id,
        publicPath: urls.pathFor(p),
        sharedSelection,
        version: p.published,
        mode: JSON.parse(v.manifest).commerceMode || "quote",
        manifest: JSON.parse(v.manifest),
        organization: orgPublic(o),
        paymentAvailable: !!o.stripe_account && pay.configured,
        domains: JSON.parse(o.domains),
      });
      return;
    }
    if (route === "/api/configurations" && method === "GET") {
      if (!user) fail("Inicia sesión.", 401);
      reply(
        res,
        all(
          "SELECT c.*,o.name organization,o.slug FROM configurations c JOIN organizations o ON o.id=c.org_id WHERE c.user_id=? ORDER BY c.created DESC",
          user.id,
        ).map((c) => ({
          ...c,
          publicPath: urls.pathFor(
            one("SELECT * FROM products WHERE id=?", c.product_id),
          ),
          manifest: JSON.parse(c.manifest),
          selection: JSON.parse(c.selection),
        })),
      );
      return;
    }
    if (route === "/api/configurations" && method === "POST") {
      limit(req, "configuration", 60);
      if (!user) fail("Inicia sesión para guardar tu configuración.", 401);
      const b = await body(req),
        p = one("SELECT * FROM products WHERE id=? AND active=1", b.productId);
      if (!p) fail("Producto no disponible.", 404);
      if (b.version !== p.published)
        fail(
          "El producto ha cambiado. Recarga para revisar las opciones.",
          409,
        );
      const m = JSON.parse(
          one(
            "SELECT manifest FROM versions WHERE product_id=? AND revision=?",
            p.id,
            p.published,
          ).manifest,
        ),
        result = evaluateProduct(m, b.selection);
      prints.check(p.id, result.selection.$print);
      const id = uid();
      run(
        "INSERT INTO configurations VALUES(?,?,?,?,?,?,?,?,?,?)",
        id,
        user.id,
        p.org_id,
        p.id,
        p.published,
        text(b.name || m.name),
        JSON.stringify(result.selection),
        JSON.stringify(m),
        result.total,
        now(),
      );
      reply(res, { id, amount: result.total }, 201);
      return;
    }
    if (route === "/api/customer/orders" && method === "GET") {
      if (!user) fail("Inicia sesión.", 401);
      reply(
        res,
        all(
          "SELECT * FROM orders WHERE user_id=? ORDER BY created DESC",
          user.id,
        ).map(orderView),
      );
      return;
    }
    if (route === "/api/customer/orders" && method === "POST") {
      if (!user) fail("Inicia sesión.", 401);
      const b = await body(req),
        c = one(
          "SELECT * FROM configurations WHERE id=? AND user_id=?",
          b.configurationId,
          user.id,
        );
      if (!c) fail("Configuración no encontrada.", 404);
      const p = one(
        "SELECT * FROM products WHERE id=? AND active=1",
        c.product_id,
      );
      if (!p || p.published !== c.version)
        fail(
          "El producto ha cambiado. Crea una nueva configuración antes de continuar.",
          409,
        );
      const existing = one(
        "SELECT * FROM orders WHERE configuration_id=? AND status NOT IN ('cancelled','refunded')",
        c.id,
      );
      if (existing) {
        reply(res, orderView(existing));
        return;
      }
      const id = uid();
      run(
        "INSERT INTO orders(id,org_id,user_id,configuration_id,status,amount,created,updated) VALUES(?,?,?,?,?,?,?,?)",
        id,
        c.org_id,
        user.id,
        c.id,
        JSON.parse(c.manifest).commerceMode === "purchase"
          ? "accepted"
          : "requested",
        c.amount,
        now(),
        now(),
      );
      if (b.message)
        run(
          "INSERT INTO messages VALUES(?,?,?,?,?)",
          uid(),
          id,
          user.id,
          text(b.message, 2000),
          now(),
        );
      audit(c.org_id, user.id, "order.created", id);
      reply(res, orderView(one("SELECT * FROM orders WHERE id=?", id)), 201);
      return;
    }
    const orderMatch = route.match(
      /^\/api\/orders\/([a-f0-9]{32})(?:\/(accept|checkout|messages|offer|status|proof|approve-proof|production-file))?$/,
    );
    if (orderMatch) {
      let { o, admin } = orderAccess(req, user, orderMatch[1]);
      const action = orderMatch[2];
      if (method === "GET" && action === "production-file") {
        const c = one(
          "SELECT * FROM configurations WHERE id=?",
          o.configuration_id,
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="yenze-pedido-${o.id.slice(0, 8)}.json"`,
        );
        reply(res, prints.packet(o, c, proofs.current(o.id), admin));
        return;
      }
      if (method === "GET" && !action) {
        reply(res, orderView(o));
        return;
      }
      if (method === "POST" && action) {
        const b = await body(req);
        ({ o, admin } = orderAccess(req, user, orderMatch[1]));
        if (action === "messages") {
          run(
            "INSERT INTO messages VALUES(?,?,?,?,?)",
            uid(),
            o.id,
            user.id,
            text(b.body, 2000),
            now(),
          );
          reply(res, orderView(o));
          return;
        }
        if (action === "proof" || action === "approve-proof") {
          const c = one(
            "SELECT * FROM configurations WHERE id=?",
            o.configuration_id,
          );
          if (action === "proof") {
            if (!admin) fail("Sin permiso.", 403);
            proofs.request(o, c, user.id, b.note);
          } else proofs.approve(o, c, user.id, b);
        } else if (action === "offer") {
          if (!admin) fail("Sin permiso.", 403);
          if (!["requested", "offered"].includes(o.status) || o.checkout_id)
            fail("Este pedido ya está aceptado o en pago.", 409);
          if (
            !Number.isSafeInteger(b.amount) ||
            b.amount < 0 ||
            b.amount > 100000000
          )
            fail("Importe no válido.");
          run(
            "UPDATE orders SET status=?,amount=?,offer_note=?,offer_revision=offer_revision+1,updated=? WHERE id=?",
            "offered",
            b.amount,
            text(b.note || "Presupuesto revisado", 2000),
            now(),
            o.id,
          );
        } else if (action === "accept") {
          if (
            o.user_id !== user.id ||
            o.status !== "offered" ||
            b.revision !== o.offer_revision
          )
            fail(
              "Este presupuesto no se puede aceptar. Actualiza la página.",
              409,
            );
          run(
            "UPDATE orders SET status=?,updated=? WHERE id=?",
            "accepted",
            now(),
            o.id,
          );
        } else if (action === "status") {
          if (!admin) fail("Sin permiso.", 403);
          const allowed = {
            paid: ["production"],
            production: ["shipped"],
            shipped: ["completed"],
            requested: ["cancelled"],
            offered: ["cancelled"],
          };
          if (!allowed[o.status]?.includes(b.status))
            fail("Cambio de estado no permitido.", 409);
          if (b.status === "production")
            proofs.assertReady(
              o,
              one(
                "SELECT * FROM configurations WHERE id=?",
                o.configuration_id,
              ),
            );
          run(
            "UPDATE orders SET status=?,updated=? WHERE id=?",
            b.status,
            now(),
            o.id,
          );
        } else if (action === "checkout") {
          if (requireVerified && !verification.verified(user.id))
            fail(
              "Confirma tu correo antes de pagar. Puedes solicitar el enlace desde tu cuenta.",
              403,
            );
          if (o.user_id !== user.id)
            fail("Solo el comprador puede pagar.", 403);
          reply(
            res,
            await pay.checkout(
              o,
              one("SELECT * FROM organizations WHERE id=?", o.org_id),
              user,
              one(
                "SELECT * FROM configurations WHERE id=?",
                o.configuration_id,
              ),
            ),
          );
          return;
        } else fail("Acción no disponible.", 404);
        audit(o.org_id, user.id, "order." + action, o.id);
        reply(res, orderView(one("SELECT * FROM orders WHERE id=?", o.id)));
        return;
      }
    }
    // Merchant and API-token surfaces. Every lookup is scoped by organization.
    const scope =
      route.includes("/tokens") ||
      route.includes("/stripe/") ||
      route.includes("/members") ||
      (route === "/api/workspace" && method === "PATCH")
        ? "owner"
        : route.endsWith("/publish") || route.endsWith("/unpublish")
          ? "publish"
          : method === "GET"
            ? "read"
            : "write";
    const { org, actor, role } = ctx(req, user, scope);
    if (route === "/api/commerce/resolve" && method === "POST") {
      const b = await body(req);
      reply(res, carts.resolve(org.id, b.ticket));
      return;
    }
    if (route === "/api/readiness" && method === "GET") {
      const count = one(
        "SELECT count(*) n FROM products WHERE org_id=? AND active=1 AND deleted_at IS NULL",
        org.id,
      ).n;
      reply(res, {
        checks: [
          {
            id: "product",
            label: "Primer configurador publicado",
            state: count ? "ready" : "pending",
            detail: count
              ? `${count} configuradores publicados.`
              : "Crea, prueba y publica un producto.",
          },
          {
            id: "domain",
            label: "Tu web autorizada",
            state: JSON.parse(org.domains).length ? "ready" : "pending",
            detail: "Añade el origen HTTPS de tu web en esta página.",
          },
          {
            id: "payments",
            label: "Pagos Stripe",
            state:
              pay.configured && process.env.STRIPE_WEBHOOK_SECRET
                ? "configured"
                : "pending",
            detail:
              !pay.configured || !process.env.STRIPE_WEBHOOK_SECRET
                ? "Faltan claves de Stripe y webhook en el servidor."
                : process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
                  ? "Modo de pruebas. No se cobran pagos reales."
                  : "Claves presentes. Comprueba la cuenta conectada y realiza una transacción de verificación.",
          },
          {
            id: "email",
            label: "Recuperación por correo",
            state:
              process.env.RESEND_API_KEY && process.env.MAIL_FROM
                ? "configured"
                : "pending",
            detail:
              "Requiere un remitente verificado y comprobar la entrega de un correo real.",
          },
          {
            id: "backup",
            label: "Recuperación de datos",
            state: "manual",
            detail:
              "Programa una copia fuera del servidor y ensaya su restauración. Las pruebas automáticas no certifican tu copia de producción.",
          },
          {
            id: "pilots",
            label: "Prueba con personas nuevas",
            state: "manual",
            detail:
              "Usa la guía de piloto con cinco negocios. No sustituir estas sesiones por pruebas automáticas.",
          },
        ],
      });
      return;
    }
    if (route === "/api/generations/config" && method === "GET") {
      reply(res, { enabled: generation.enabled(org.id) });
      return;
    }
    if (route === "/api/generations" && method === "POST") {
      reply(res, await generation.create(org.id, actor, await body(req)), 201);
      return;
    }
    const gm = route.match(
      /^\/api\/generations\/([a-f0-9]{32})(?:\/(import))?$/,
    );
    if (gm) {
      if (method === "GET" && !gm[2]) {
        reply(res, await generation.get(org.id, gm[1]));
        return;
      }
      if (method === "POST" && gm[2] === "import") {
        reply(res, await generation.importModel(org.id, actor, gm[1]));
        return;
      }
    }
    if (route === "/api/workspace" && method === "GET") {
      reply(res, {
        ...orgPublic(org),
        domains: JSON.parse(org.domains),
        role,
        stripeConfigured: pay.configured,
      });
      return;
    }
    if (route === "/api/workspace" && method === "PATCH") {
      const b = await body(req);
      const name = text(b.name, 80);
      if (
        !/^#[a-f\d]{6}$/i.test(b.accent) ||
        !Array.isArray(b.domains) ||
        b.domains.length > 20
      )
        fail("Revisa la marca y los dominios.");
      for (const d of b.domains) {
        let u;
        try {
          u = new URL(d);
        } catch {
          fail("Dominio no válido.");
        }
        if (
          u.origin !== d ||
          (u.protocol !== "https:" &&
            !(
              !prod &&
              u.protocol === "http:" &&
              ["localhost", "127.0.0.1"].includes(u.hostname)
            ))
        )
          fail("Usa orígenes HTTPS exactos, sin rutas.");
      }
      run(
        "UPDATE organizations SET name=?,accent=?,domains=? WHERE id=?",
        name,
        b.accent,
        JSON.stringify(b.domains),
        org.id,
      );
      audit(org.id, actor, "workspace.updated", org.id);
      reply(res, { ok: true });
      return;
    }
    if (route === "/api/dashboard") {
      reply(res, {
        products: one(
          "SELECT count(*) n FROM products WHERE org_id=? AND deleted_at IS NULL",
          org.id,
        ).n,
        published: one(
          "SELECT count(*) n FROM products WHERE org_id=? AND active=1",
          org.id,
        ).n,
        requests: one(
          "SELECT count(*) n FROM orders WHERE org_id=? AND status IN ('requested','offered')",
          org.id,
        ).n,
        sales: one(
          "SELECT coalesce(sum(amount),0) n FROM orders WHERE org_id=? AND status IN ('paid','production','shipped','completed')",
          org.id,
        ).n,
        activity: all(
          "SELECT action,target,created FROM audit WHERE org_id=? ORDER BY id DESC LIMIT 8",
          org.id,
        ),
      });
      return;
    }
    if (route === "/api/products" && method === "GET") {
      reply(
        res,
        all(
          "SELECT * FROM products WHERE org_id=? AND deleted_at IS NULL ORDER BY updated DESC",
          org.id,
        ).map(product),
      );
      return;
    }
    if (route === "/api/products" && method === "POST") {
      const b = await body(req);
      if (!templates.some((t) => t.id === b.template))
        fail("Plantilla no encontrada.");
      let prepared;
      if (b.setup !== undefined) {
        try {
          prepared = setupGroups(b.setup);
        } catch (e) {
          fail(e.message);
        }
      }
      const id = uid();
      transaction(() => {
        const draft = makeTemplate(b.template, (bytes, mime, name) =>
          storeAsset(org.id, bytes, mime, name, { width: 1000, height: 850 }),
        );
        if (b.name) draft.name = text(b.name);
        if (prepared) {
          draft.name = b.setup.name.trim();
          draft.basePrice = b.setup.basePrice;
          // Textile templates retain their actual material controls; questions are editable afterwards.
          if (b.template !== "shirt-3d") draft.groups = prepared;
          else
            draft.groups = [
              draft.groups[0],
              ...prepared.map((q, i) => ({ ...q, order: i + 1 })),
            ];
          draft.industry = b.setup.industry;
        }
        validManifest(draft, assetCheck(org.id));
        run(
          "INSERT INTO products(id,org_id,name,niche,draft,created,updated) VALUES(?,?,?,?,?,?,?)",
          id,
          org.id,
          draft.name,
          prepared
            ? industries.find((i) => i.id === b.setup.industry).label
            : templates.find((t) => t.id === b.template).niche,
          JSON.stringify(draft),
          now(),
          now(),
        );
        audit(org.id, actor, "product.created", id);
      });
      reply(res, product(getProduct(id, org.id)), 201);
      return;
    }
    if (route === "/api/trash" && method === "GET") {
      reply(
        res,
        all(
          "SELECT id,name,niche,deleted_at FROM products WHERE org_id=? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC",
          org.id,
        ),
      );
      return;
    }
    const restore = route.match(/^\/api\/products\/([a-f0-9]{32})\/restore$/);
    if (restore && method === "POST") {
      const p = one(
        "SELECT id FROM products WHERE id=? AND org_id=? AND deleted_at IS NOT NULL",
        restore[1],
        org.id,
      );
      if (!p) fail("Configurador no encontrado en la papelera.", 404);
      run(
        "UPDATE products SET deleted_at=NULL,active=0,revision=revision+1,updated=? WHERE id=?",
        now(),
        p.id,
      );
      audit(org.id, actor, "product.restored", p.id);
      reply(res, product(getProduct(p.id, org.id)));
      return;
    }
    const pm = route.match(
      /^\/api\/products\/([a-f0-9]{32})(?:\/(publish|unpublish|duplicate|versions))?$/,
    );
    if (pm) {
      let p = getProduct(pm[1], org.id);
      if (method === "DELETE" && !pm[2]) {
        if (p.active) ctx(req, user, "publish");
        run(
          "UPDATE products SET deleted_at=?,active=0,revision=revision+1,updated=? WHERE id=? AND org_id=?",
          now(),
          now(),
          p.id,
          org.id,
        );
        audit(org.id, actor, "product.deleted", p.id);
        reply(res, { ok: true, restorable: true });
        return;
      }

      if (method === "GET" && !pm[2]) {
        reply(res, product(p));
        return;
      }
      if (method === "GET" && pm[2] === "versions") {
        reply(
          res,
          all(
            "SELECT revision,created FROM versions WHERE product_id=? AND org_id=? ORDER BY revision DESC",
            p.id,
            org.id,
          ),
        );
        return;
      }
      if (method === "PATCH" && !pm[2]) {
        const b = await body(req);
        p = getProduct(pm[1], org.id);
        if (b.revision !== p.revision)
          fail("Hay cambios más recientes. Recarga antes de guardar.", 409);
        const m = validManifest(b.manifest, assetCheck(org.id));
        prints.check(p.id, m.personalization?.design);
        if (!["quote", "purchase"].includes(b.mode)) fail("Modo no válido.");
        run(
          "UPDATE products SET name=?,draft=?,mode=?,revision=revision+1,updated=? WHERE id=? AND org_id=?",
          m.name,
          JSON.stringify(m),
          b.mode,
          now(),
          p.id,
          org.id,
        );
        audit(org.id, actor, "product.saved", p.id);
        reply(res, product(getProduct(p.id, org.id)));
        return;
      }
      if (method === "POST" && pm[2] === "publish") {
        const b = await body(req);
        p = getProduct(pm[1], org.id);
        if (b.revision !== p.revision)
          fail("Guarda y revisa la versión actual antes de publicar.", 409);
        const m = validManifest(JSON.parse(p.draft), assetCheck(org.id), {
          publish: true,
        });
        m.commerceMode = p.mode;
        if (p.mode === "purchase" && !(await pay.status(org)).chargesEnabled)
          fail(
            "Conecta y activa Stripe antes de publicar con compra directa.",
            409,
          );
        transaction(() => {
          if (getProduct(p.id, org.id).revision !== p.revision)
            fail("El borrador ha cambiado. Revisa y publica de nuevo.", 409);
          run(
            "INSERT OR IGNORE INTO versions VALUES(?,?,?,?,?)",
            p.id,
            p.revision,
            org.id,
            JSON.stringify(m),
            now(),
          );
          run(
            "UPDATE products SET published=?,active=1,updated=? WHERE id=?",
            p.revision,
            now(),
            p.id,
          );
          audit(org.id, actor, "product.published", p.id);
        });
        reply(res, product(getProduct(p.id, org.id)));
        return;
      }
      if (method === "POST" && pm[2] === "unpublish") {
        run("UPDATE products SET active=0,updated=? WHERE id=?", now(), p.id);
        audit(org.id, actor, "product.unpublished", p.id);
        reply(res, { ok: true });
        return;
      }
      if (method === "POST" && pm[2] === "duplicate") {
        const id = uid(),
          m = JSON.parse(p.draft);
        m.name += " · copia";
        m.name = m.name.slice(0, 120);
        transaction(() => {
          run(
            "INSERT INTO products(id,org_id,name,niche,mode,draft,created,updated) VALUES(?,?,?,?,?,?,?,?)",
            id,
            org.id,
            m.name,
            p.niche,
            p.mode,
            JSON.stringify(m),
            now(),
            now(),
          );
          prints.clone(p.id, id, org.id, m.personalization?.design);
          run("UPDATE products SET draft=? WHERE id=?", JSON.stringify(m), id);
          audit(org.id, actor, "product.duplicated", id);
        });
        reply(res, product(getProduct(id, org.id)), 201);
        return;
      }
    }
    if (route === "/api/assets" && method === "POST") {
      const b = await body(req),
        name = text(b.name, 180);
      if (typeof b.data !== "string" || b.data.length > 28 * 1024 * 1024)
        fail("Archivo demasiado grande.", 413);
      let bytes = Buffer.from(b.data, "base64");
      if (bytes.length > 20 * 1024 * 1024)
        fail("Máximo 20 MB por archivo.", 413);
      const usage = one(
        "SELECT coalesce(sum(length(bytes)),0) n FROM assets WHERE org_id=?",
        org.id,
      ).n;
      if (usage + bytes.length > 250 * 1024 * 1024)
        fail("Límite de 250 MB por empresa.", 413);
      const parsed = await parseAsset(bytes, name);
      bytes = parsed.bytes;
      const { mime, meta } = parsed;
      if (usage + bytes.length > 250 * 1024 * 1024)
        fail("Límite de 250 MB por empresa.", 413);
      const id = storeAsset(org.id, bytes, mime, name, meta);
      reply(res, { id, name, mime, ...meta }, 201);
      return;
    }
    if (route === "/api/orders" && method === "GET") {
      reply(
        res,
        all(
          "SELECT * FROM orders WHERE org_id=? ORDER BY created DESC",
          org.id,
        ).map(orderView),
      );
      return;
    }
    if (route === "/api/customers" && method === "GET") {
      reply(
        res,
        all(
          "SELECT u.id,u.name,u.email,count(DISTINCT c.id) configurations,count(DISTINCT o.id) orders FROM users u JOIN configurations c ON c.user_id=u.id AND c.org_id=? LEFT JOIN orders o ON o.user_id=u.id AND o.org_id=? GROUP BY u.id",
          org.id,
          org.id,
        ),
      );
      return;
    }
    if (route === "/api/stripe/status" && method === "GET") {
      reply(res, await pay.status(org));
      return;
    }
    if (route === "/api/stripe/connect" && method === "POST") {
      reply(res, await pay.connect(org, user.email));
      return;
    }
    if (route === "/api/tokens" && method === "GET") {
      reply(
        res,
        all(
          "SELECT id,label,scopes,created FROM tokens WHERE org_id=?",
          org.id,
        ),
      );
      return;
    }
    if (route === "/api/tokens" && method === "POST") {
      const b = await body(req),
        label = text(b.label, 80);
      if (
        !Array.isArray(b.scopes) ||
        !b.scopes.length ||
        b.scopes.some((s) => !["read", "write", "publish"].includes(s))
      )
        fail("Permisos no válidos.");
      const id = uid(),
        token = "yz_" + randomBytes(32).toString("hex");
      run(
        "INSERT INTO tokens VALUES(?,?,?,?,?,?)",
        id,
        org.id,
        hash(token),
        label,
        JSON.stringify(b.scopes),
        now(),
      );
      reply(res, { id, token }, 201);
      return;
    }
    const tm = route.match(/^\/api\/tokens\/([a-f0-9]{32})$/);
    if (tm && method === "DELETE") {
      run("DELETE FROM tokens WHERE id=? AND org_id=?", tm[1], org.id);
      reply(res, { ok: true });
      return;
    }
    if (route === "/api/members" && method === "GET") {
      reply(
        res,
        all(
          "SELECT u.id,u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE org_id=?",
          org.id,
        ),
      );
      return;
    }
    if (route === "/api/members" && method === "POST") {
      const b = await body(req),
        email = text(b.email, 254).toLowerCase(),
        target = one("SELECT id FROM users WHERE email=?", email);
      if (!target) fail("Esta persona debe crear primero su cuenta en Yenze.");
      run(
        "INSERT OR IGNORE INTO memberships VALUES(?,?,?)",
        target.id,
        org.id,
        "editor",
      );
      audit(org.id, actor, "member.added", target.id);
      reply(res, { ok: true });
      return;
    }
    const mm = route.match(/^\/api\/members\/([a-f0-9]{32})$/);
    if (mm && method === "DELETE") {
      run(
        "DELETE FROM memberships WHERE user_id=? AND org_id=? AND role='editor'",
        mm[1],
        org.id,
      );
      reply(res, { ok: true });
      return;
    }
    fail("Ruta no encontrada.", 404);
  } catch (e) {
    if (!e.status) console.error("Request failed:", e.message);
    if (!res.headersSent)
      reply(
        res,
        {
          error: e.status
            ? e.message
            : "No se ha podido completar la operación. Inténtalo de nuevo.",
        },
        e.status || 500,
      );
    else res.end();
  }
});
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Yenze Studio API · http://localhost:${port}`),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
