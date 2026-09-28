import { randomBytes } from "node:crypto";
import { fail, evaluateProduct } from "./validation.mjs";
export async function commerce(db, prints) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS commerce_tickets(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES organizations(id),product_id TEXT NOT NULL REFERENCES products(id),version INTEGER NOT NULL,selection TEXT NOT NULL,amount INTEGER NOT NULL,expires INTEGER NOT NULL);`,
  );
  async function issue(productId, b) {
    const p = await db
      .prepare(
        "SELECT * FROM products WHERE id=? AND active=1 AND deleted_at IS NULL",
      )
      .get(productId);
    if (!p) fail("Producto no disponible.", 404);
    if (p.published !== b.version)
      fail("El producto ha cambiado. Recarga antes de añadirlo.", 409);
    const m = JSON.parse(
      (
        await db
          .prepare(
            "SELECT manifest FROM versions WHERE product_id=? AND revision=?",
          )
          .get(p.id, p.published)
      ).manifest,
    );
    const result = evaluateProduct(m, b.selection);
    await prints.check(p.id, result.selection.$print);
    await db
      .prepare("DELETE FROM commerce_tickets WHERE expires<?")
      .run(Date.now());
    if (
      (
        await db
          .prepare("SELECT count(*) n FROM commerce_tickets WHERE org_id=?")
          .get(p.org_id)
      ).n >= 1000
    )
      fail("Demasiadas solicitudes de carrito. Inténtalo más tarde.", 429);
    const ticket = randomBytes(32).toString("hex"),
      expires = Date.now() + 15 * 60 * 1000;
    await db
      .prepare("INSERT INTO commerce_tickets VALUES(?,?,?,?,?,?,?)")
      .run(
        ticket,
        p.org_id,
        p.id,
        p.published,
        JSON.stringify(result.selection),
        result.total,
        expires,
      );
    return { ticket, expires };
  }
  async function resolve(org, id) {
    if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id))
      fail("Referencia de carrito no válida.");
    const t = await db
      .prepare(
        "SELECT * FROM commerce_tickets WHERE id=? AND org_id=? AND expires>?",
      )
      .get(id, org, Date.now());
    if (!t)
      fail("La selección ha caducado o no pertenece a este comercio.", 404);
    const p = await db
      .prepare(
        "SELECT * FROM products WHERE id=? AND active=1 AND deleted_at IS NULL",
      )
      .get(t.product_id);
    if (!p || p.published !== t.version)
      fail("El producto ha cambiado. Configúralo de nuevo.", 409);
    const m = JSON.parse(
      (
        await db
          .prepare(
            "SELECT manifest FROM versions WHERE product_id=? AND revision=?",
          )
          .get(p.id, t.version)
      ).manifest,
    );
    const r = evaluateProduct(m, JSON.parse(t.selection));
    return {
      ticket: id,
      productId: p.id,
      version: t.version,
      name: m.name,
      amount: r.total,
      currency: m.currency,
      selection: r.selection,
      expires: t.expires,
      priceIncludesTax: false,
      shippingIncluded: false,
    };
  }
  return { issue, resolve };
}
