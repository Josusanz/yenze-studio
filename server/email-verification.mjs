import { randomBytes, createHash } from "node:crypto";
import { fail } from "./validation.mjs";
export async function emailVerification(db, { mail, origin, enabled }) {
  await db.exec(`CREATE TABLE IF NOT EXISTS email_verified(user_id TEXT PRIMARY KEY REFERENCES users(id),verified_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS email_verifications(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);`);
  const digest = (s) => createHash("sha256").update(s).digest("hex");
  const verified = async (userId) =>
    !!(await db
      .prepare("SELECT 1 FROM email_verified WHERE user_id=?")
      .get(userId));
  async function send(user) {
    if (await verified(user.id)) return { verified: true };
    if (!enabled())
      fail("La verificación por correo todavía no está configurada.", 503);
    const token = randomBytes(32).toString("hex");
    await db
      .prepare("DELETE FROM email_verifications WHERE expires<?")
      .run(Date.now());
    const previous = await db
      .prepare(
        "SELECT expires FROM email_verifications WHERE user_id=? ORDER BY expires DESC LIMIT 1",
      )
      .get(user.id);
    if (previous && previous.expires > Date.now() + 24 * 3600000 - 60000)
      fail("Espera un minuto antes de pedir otro enlace.", 429);
    // Retain older valid links until one succeeds; an email provider outage must not revoke a delivered link.
    const hashed = digest(token);
    await db
      .prepare("INSERT INTO email_verifications VALUES(?,?,?)")
      .run(hashed, user.id, Date.now() + 24 * 3600000);
    try {
      if (
        !(await mail(
          user.email,
          "Confirma tu correo en Yenze",
          `<p>Confirma tu correo para proteger tus pedidos.</p><p><a href="${origin}/?verify=${token}">Confirmar mi correo</a></p><p>El enlace caduca en 24 horas. Si no lo has solicitado, ignora este mensaje.</p>`,
        ))
      )
        throw Error("No se pudo enviar el correo.");
    } catch (e) {
      await db
        .prepare("DELETE FROM email_verifications WHERE token=?")
        .run(hashed);
      throw e;
    }
    return { sent: true };
  }
  async function confirm(token) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      fail("El enlace de verificación no es válido.");
    const row = await db
      .prepare("SELECT * FROM email_verifications WHERE token=? AND expires>?")
      .get(digest(token), Date.now());
    if (!row)
      fail(
        "El enlace ha caducado o ya se ha utilizado. Solicita uno nuevo.",
        409,
      );
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db
        .prepare("INSERT OR IGNORE INTO email_verified VALUES(?,?)")
        .run(row.user_id, new Date().toISOString());
      await db
        .prepare("DELETE FROM email_verifications WHERE user_id=?")
        .run(row.user_id);
      await db.exec("COMMIT");
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
    return { verified: true };
  }
  return { send, confirm, verified };
}
