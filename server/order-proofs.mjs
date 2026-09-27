import { createHash } from "node:crypto";
import { fail } from "./validation.mjs";
export function orderProofs(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS order_proofs(order_id TEXT NOT NULL REFERENCES orders(id),revision INTEGER NOT NULL,digest TEXT NOT NULL,note TEXT NOT NULL,requested_by TEXT NOT NULL,requested_at TEXT NOT NULL,approved_by TEXT,approved_at TEXT,PRIMARY KEY(order_id,revision));`,
  );
  const current = (id) =>
    db
      .prepare(
        "SELECT * FROM order_proofs WHERE order_id=? ORDER BY revision DESC LIMIT 1",
      )
      .get(id) ?? null;
  const digest = (c) =>
    createHash("sha256")
      .update(c.manifest + "\n" + c.selection)
      .digest("hex");
  function request(o, c, user, note) {
    if (!["requested", "offered", "accepted", "paid"].includes(o.status))
      fail("Este pedido ya no admite una nueva revisión.", 409);
    if (typeof note !== "string" || !note.trim() || note.length > 2000)
      fail("Indica qué debe revisar el cliente.");
    const revision = (current(o.id)?.revision ?? 0) + 1;
    db.prepare(
      "INSERT INTO order_proofs(order_id,revision,digest,note,requested_by,requested_at) VALUES(?,?,?,?,?,?)",
    ).run(
      o.id,
      revision,
      digest(c),
      note.trim(),
      user,
      new Date().toISOString(),
    );
  }
  function approve(o, c, user, b) {
    const proof = current(o.id);
    if (o.user_id !== user)
      fail("Solo el comprador puede aprobar su diseño.", 403);
    if (
      !["requested", "offered", "accepted", "paid"].includes(o.status) ||
      !proof ||
      b.revision !== proof.revision ||
      b.digest !== proof.digest ||
      proof.digest !== digest(c) ||
      b.confirmed !== true
    )
      fail(
        "La revisión ha cambiado. Vuelve a abrir el pedido antes de aprobar.",
        409,
      );
    if (!proof.approved_at)
      db.prepare(
        "UPDATE order_proofs SET approved_by=?,approved_at=? WHERE order_id=? AND revision=?",
      ).run(user, new Date().toISOString(), o.id, proof.revision);
  }
  function assertReady(o, c) {
    const p = current(o.id);
    if (
      (JSON.parse(c.manifest).personalization || p) &&
      (!p?.approved_at || p.digest !== digest(c))
    )
      fail(
        "El cliente debe aprobar esta versión antes de pasar a producción.",
        409,
      );
  }
  return { current, request, approve, assertReady };
}
